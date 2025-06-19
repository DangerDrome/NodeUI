/**
 * @fileoverview A simple, decoupled event bus (Pub/Sub) for the entire application.
 * This allows modules to communicate without direct dependencies.
 */

class EventEmitter {
    /**
     * Initializes the event listeners map.
     */
    constructor() {
        this.events = {};
    }

    /**
     * Subscribes a callback function to a specific event.
     * @param {string} eventName - The name of the event to subscribe to.
     * @param {Function} callback - The function to execute when the event is published.
     * @returns {object} An object with an `unsubscribe` method.
     */
    subscribe(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        
        this.events[eventName].push(callback);
        
        // Allow for easy unsubscription
        return {
            unsubscribe: () => {
                this.events[eventName] = this.events[eventName].filter(
                    (eventCallback) => callback !== eventCallback
                );
            }
        };
    }

    /**
     * Publishes an event, triggering all subscribed callbacks.
     * Also triggers wildcard ('*') subscribers.
     * @param {string} eventName - The name of the event to publish.
     * @param {*} data - The data to pass to the subscribed callbacks.
     */
    publish(eventName, data) {
        const eventCallbacks = this.events[eventName];
        const wildcardCallbacks = this.events['*'];

        // Handle wildcard subscribers first to ensure logging occurs
        if (wildcardCallbacks) {
            wildcardCallbacks.forEach((callback) => {
                try {
                    // Pass the event name and data to wildcard listeners
                    callback(eventName, data);
                } catch (error) {
                    console.error(`Error in wildcard event handler:`, error);
                }
            });
        }

        if (eventCallbacks) {
            eventCallbacks.forEach((callback) => {
                try {
                    // Pass only the data to specific listeners
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventName}:`, error);
                }
            });
        }
    }
}

// Create a single, global instance of the event emitter for the application
const events = new EventEmitter(); 