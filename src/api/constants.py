# Constants
MAX_QUEUE_SIZE = 100  # Reduced from 5000 for better memory efficiency and backpressure
SLOW_CLIENT_THRESHOLD = 50  # Warn if queue > 50% full
ADAPTIVE_QUEUE_CHECK_INTERVAL = 5  # Check queue depth every 5 seconds
