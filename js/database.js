/**
 * @fileoverview Manages IndexedDB for storing and retrieving large file assets
 * like videos and images, allowing them to persist between sessions.
 */

class AssetDatabase {
    constructor(dbName = 'NodeUI-Assets', storeName = 'files') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    async open() {
        if (this.db) {
            return this.db;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Saves a file to the database.
     * @param {File} file The file to save.
     * @returns {Promise<string>} A promise that resolves with the unique ID of the saved file.
     */
    async saveFile(file) {
        const db = await this.open();
        const id = crypto.randomUUID();
        const data = { id, file };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data);

            request.onsuccess = () => {
                resolve(id);
            };

            request.onerror = (event) => {
                console.error('Error saving file:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Retrieves a file from the database by its ID.
     * @param {string} id The unique ID of the file.
     * @returns {Promise<File>} A promise that resolves with the retrieved file.
     */
    async getFile(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = (event) => {
                if (event.target.result) {
                    resolve(event.target.result.file);
                } else {
                    reject(new Error(`File with id ${id} not found.`));
                }
            };

            request.onerror = (event) => {
                console.error('Error retrieving file:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}

// Create a global instance for the app to use
const assetDb = new AssetDatabase(); 