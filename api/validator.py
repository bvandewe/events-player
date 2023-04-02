import logging

from fastapi import (
    Header,
    HTTPException
)

log = logging.getLogger(__name__)


# Validator
async def validate_cloud_event(content_type: str = Header(...)):
    # TODO: add validation of the event attributes!
    valid = True
    if content_type != "application/cloudevents+json":
        log.info(f"Received invalid event with Content-Type: {content_type}")
        valid = False
    elif "application/cloudevents+json" not in content_type:
        log.info(f"Missing 'application/cloudevents+json' in Content-Type: {content_type}")
        valid = False

    if not valid:
        raise HTTPException(status_code=400,
                            detail="Only CloudEvents are supported! (Missing Content-Type: application/cloudevents+json)"
                            )
