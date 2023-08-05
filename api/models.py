import typing
from pydantic import BaseModel, AnyUrl, validator


class EventGeneratorRequest(BaseModel):
    event_gateway: AnyUrl
    event_source: str
    event_type: str
    event_subject: str
    event_data: str
    iterations: int = 1
    delay: int = 100

    @validator("iterations")
    def check_positive_iterations(cls, value):
        int_value = int(value)
        if int_value < 0:
            raise ValueError("Iterations value must be a positive integer")
        return int_value

    @validator("delay")
    def check_positive_delay(cls, value):
        int_value = int(value)
        if int_value < 0:
            raise ValueError("Delay value must be a positive integer")
        return int_value

    class Config:
        extra = "forbid"


class EventGeneratorTask(BaseModel):
    id: str
    status: str
    progress: int = 0
    client_id: str | None

    def __setitem__(self, key: str, value: typing.Any):
        setattr(self, key, value)
