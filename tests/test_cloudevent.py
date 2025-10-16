import sys
sys.path.insert(0, 'src')

from api.models import CloudEvent
import json

# Test data with Python types
test_data = {
    "specversion": "1.0",
    "id": "test-direct-post",
    "time": "2025-10-16T00:00:00Z",
    "datacontenttype": "application/json",
    "type": "com.test.direct",
    "source": "test",
    "subject": "test",
    "data": {"foo": True, "bar": False, "baz": None}
}

print("Original payload:")
print(json.dumps(test_data, indent=2))

# Create CloudEvent
ce = CloudEvent(**test_data)
print("\nCloudEvent model_dump():")
print(ce.model_dump())

print("\nCloudEvent model_dump(mode='json'):")
normalized = ce.model_dump(mode="json")
print(normalized)

print("\nAfter json.loads(json.dumps(normalized)):")
final = json.loads(json.dumps(normalized))
print(json.dumps(final, indent=2))
