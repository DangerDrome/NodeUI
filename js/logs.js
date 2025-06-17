/**
 * @fileoverview A simple logging service for debugging.
 * Subscribes to all events using a wildcard and logs them to the console.
 * This provides a real-time trace of application activity.
 */

(function() {
    const isDebugging = true; // Set to false in production

    if (!isDebugging) {
        return;
    }

    /**
     * Handles logging events to the console.
     * @param {string} eventName - The name of the event that was published.
     * @param {*} data - The data payload of the event.
     */
    function logEventHandler(eventName, data) {
        console.log(
            `%c[EVENT]%c ${eventName}`,
            'color: #3ecf8e; font-weight: bold;',
            'color: inherit;',
            data !== undefined ? data : ''
        );
    }

    // Subscribe to all events using the wildcard
    events.subscribe('*', logEventHandler);

    console.log('%c[Logger]%c Service initialized.', 'color: #3ecf8e; font-weight: bold;', 'color: inherit;');
})(); 