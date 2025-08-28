#!/bin/bash

# NodeUI Collaboration Server Manager
# Simple script to manage the WebSocket server

SERVER_DIR="server"
SERVER_PORT=8080
PID_FILE="$SERVER_DIR/.server.pid"
LOG_FILE="$SERVER_DIR/server.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server directory exists
check_server_dir() {
    if [ ! -d "$SERVER_DIR" ]; then
        echo -e "${RED}Error: Server directory not found at $SERVER_DIR${NC}"
        exit 1
    fi
}

# Check if dependencies are installed
check_dependencies() {
    if [ ! -d "$SERVER_DIR/node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        cd "$SERVER_DIR" && npm install && cd ..
    fi
}

# Get server PID if running
get_pid() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "$PID"
        else
            rm -f "$PID_FILE"
            echo ""
        fi
    else
        echo ""
    fi
}

# Check if port is in use
check_port() {
    if lsof -Pi :$SERVER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Start server
start_server() {
    PID=$(get_pid)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}Server is already running (PID: $PID)${NC}"
        return
    fi
    
    if check_port; then
        echo -e "${RED}Error: Port $SERVER_PORT is already in use${NC}"
        exit 1
    fi
    
    check_server_dir
    check_dependencies
    
    echo -e "${GREEN}Starting collaboration server on port $SERVER_PORT...${NC}"
    cd "$SERVER_DIR" && nohup node index.js > "../$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "../$PID_FILE"
    cd ..
    
    # Wait a moment and check if server started successfully
    sleep 2
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${GREEN}Server started successfully (PID: $PID)${NC}"
        echo -e "${GREEN}Log file: $LOG_FILE${NC}"
    else
        echo -e "${RED}Failed to start server${NC}"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Stop server
stop_server() {
    PID=$(get_pid)
    if [ -z "$PID" ]; then
        echo -e "${YELLOW}Server is not running${NC}"
        return
    fi
    
    echo -e "${YELLOW}Stopping server (PID: $PID)...${NC}"
    kill "$PID"
    
    # Wait for process to stop
    COUNT=0
    while ps -p "$PID" > /dev/null 2>&1; do
        sleep 1
        COUNT=$((COUNT + 1))
        if [ $COUNT -gt 10 ]; then
            echo -e "${RED}Server didn't stop gracefully. Forcing...${NC}"
            kill -9 "$PID"
            break
        fi
    done
    
    rm -f "$PID_FILE"
    echo -e "${GREEN}Server stopped${NC}"
}

# Restart server
restart_server() {
    echo -e "${YELLOW}Restarting server...${NC}"
    stop_server
    sleep 1
    start_server
}

# Show server status
show_status() {
    PID=$(get_pid)
    if [ ! -z "$PID" ]; then
        echo -e "${GREEN}Server is running${NC}"
        echo "  PID: $PID"
        echo "  Port: $SERVER_PORT"
        echo "  Log: $LOG_FILE"
        
        # Show last few lines of log
        if [ -f "$LOG_FILE" ]; then
            echo -e "\nLast 5 log entries:"
            tail -5 "$LOG_FILE"
        fi
    else
        echo -e "${RED}Server is not running${NC}"
        
        if check_port; then
            echo -e "${YELLOW}Warning: Port $SERVER_PORT is in use by another process${NC}"
        fi
    fi
}

# Show usage
show_usage() {
    echo "NodeUI Collaboration Server Manager"
    echo ""
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the collaboration server"
    echo "  stop    - Stop the collaboration server"
    echo "  restart - Restart the collaboration server"
    echo "  status  - Show server status"
    echo ""
}

# Main command handler
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    *)
        show_usage
        exit 1
        ;;
esac