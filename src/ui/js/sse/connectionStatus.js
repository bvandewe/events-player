/**
 * ConnectionStatusManager - Manages SSE connection status indicator updates
 * 
 * Provides visual feedback for SSE connection states:
 * - open: Connected (green)
 * - connect: Receiving events (blue glow for 10s)
 * - error: Connection error (red blink)
 */

class ConnectionStatusManager {
    constructor() {
        this.statusElement = null;
        this.timer = null;
        this.heartbeatTimer = null;
    }

    /**
     * Initialize the status manager
     * @param {string} elementId - ID of the status indicator element (default: 'connectionStatusIndicator')
     */
    init(elementId = 'connectionStatusIndicator') {
        this.statusElement = document.getElementById(elementId);
        if (!this.statusElement) {
            console.warn(`Connection status element '${elementId}' not found`);
        }
        return this;
    }

    /**
     * Start the heartbeat timer (15s) to refresh "open" status
     */
    startHeartbeat() {
        // Clear any existing heartbeat
        this.stopHeartbeat();

        // Refresh the open status every 15 seconds
        this.heartbeatTimer = setInterval(() => {
            // Only update if we're in the base "open" state (green, no glow, no blink)
            if (this.statusElement &&
                this.statusElement.style.backgroundColor === 'green' &&
                !this.statusElement.classList.contains('glow') &&
                !this.statusElement.classList.contains('blink')) {
                console.log('[ConnectionStatus] Heartbeat refresh');
                this.updateStatus('open');
            }
        }, 15000); // 15 seconds
    }

    /**
     * Stop the heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Update connection status indicator
     * @param {string} status - Status: 'open', 'connect', 'error', 'newtimer', 'cleartimer'
     */
    updateStatus(status) {
        if (!this.statusElement) {
            return;
        }

        switch (status) {
            case "open":
                console.log("Connection opened");
                this.statusElement.style.backgroundColor = "green";
                this.statusElement.style.color = "";
                this.statusElement.classList.remove('glow');
                this.statusElement.classList.remove('blink');
                this.statusElement.setAttribute("title", "Connected - its quiet here though!");
                // Start heartbeat to refresh every 15s
                this.startHeartbeat();
                break;

            case "connect":
                this.statusElement.style.backgroundColor = "#4DCEF3";
                this.statusElement.style.color = "#1a1d20";
                this.statusElement.classList.add('glow');
                this.statusElement.classList.remove('blink');
                this.statusElement.setAttribute("title", "Connected - happy to see some traffic here!");
                break;

            case "error":
                console.log("Connection error");
                this.statusElement.style.backgroundColor = "#800000";
                this.statusElement.style.color = "#FFF";
                this.statusElement.classList.remove('glow');
                this.statusElement.classList.add('blink');
                this.statusElement.setAttribute("title", "Disconnected... Trying to reconnect every 2s...");
                // Stop heartbeat when connection is lost
                this.stopHeartbeat();
                break;

            case "newtimer":
                this.timer = setTimeout(() => {
                    this.statusElement.style.backgroundColor = "green";
                    this.statusElement.style.color = "";
                    this.statusElement.classList.remove('glow');
                    this.statusElement.setAttribute("title", "Connected - its quiet here though!");
                }, 10000);
                break;

            case "cleartimer":
                clearTimeout(this.timer);
                break;

            default:
                break;
        }
    }

    /**
     * Cleanup timer on destroy
     */
    destroy() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.stopHeartbeat();
    }
}

// Export singleton instance
export const connectionStatus = new ConnectionStatusManager();
