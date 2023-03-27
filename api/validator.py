from fastapi import (
    Header,
    HTTPException
)


# Validator
async def validate_cloud_event(content_type: str = Header(...)):
    # TODO: add validation of the event attributes!
    if content_type != "application/cloudevents+json":
        raise HTTPException(status_code=400,
                            detail="Only CloudEvents are supported! (Missing Content-Type: application/cloudevents+json)"
                            )
