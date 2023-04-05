import {toastController} from "../ui/toast";

export const sseEventsController = (() => {

    const sseEventPath = '/stream/events';
    var sseConnectionStatus = document.getElementById('sseConnectionStatus');
    var eventsStackDiv = document.getElementById('events-stack');
    var eventsCount = 0;
    var sseConnectionTimer;

    const resetEventsCount = () => {
        eventsCount = 0;
    };

    const incrementEventsCount = () => {
        var eventCountSpan = document.getElementById('event-count');
        eventsCount++;
        eventCountSpan.innerHTML = eventsCount;
        document.title = "CloudEvents Viewer (" + eventsCount + ")";
    };

    const handleNewEvent = (event) => {
        if ("data" in event){
            var hasError = false;
            try {
                // 
                var eventData = JSON.parse(event.data.replace(/'/g, "\""));
                var cloudEventData = eventData.cloudevent;
            } catch (error) {
                // Simulate a Validation Error for now
                hasError = true;
                var result = {
                    "detail": [
                        {
                            "loc": ["event.data"], 
                            "msg": "Event data is not valid JSON!", 
                            "type": "JSON.parse"
                        }
                    ]
                }
                toastController.showToast(result);
                var eventData = event.data.replace(/'/g, "\"");
                // Assuming .data is the last attribute in the event... (!!!)
                var strippedEventData = eventData.substring(0, eventData.indexOf(", \"data\"")) + "}}";
                // var rawEventData = eventData.substring(eventData.indexOf("\"data\""));                
                eventData = JSON.parse(strippedEventData);
                var cloudEventData = eventData.cloudevent;
                cloudEventData.data = result;
                cloudEventData.source = "ERROR: " + cloudEventData.source;
                cloudEventData.type = "ERROR: " + cloudEventData.type;
            }
            var eventBox = document.createElement('div');
            var eventHeader = document.createElement('div');
            var eventMessage = document.createElement('div');
            var eventLeftTitle = document.createElement('span');
            var eventNumber = document.createElement('span');
            var eventTimestamp = document.createElement('span');
            var eventSource = document.createElement('span');
            var eventType = document.createElement('span');
        
            eventBox.classList.add('event-box');
            eventHeader.classList.add('event-header');
            eventMessage.classList.add('event-message');
        
            eventNumber.innerHTML = '#' + eventsCount + ' ';
            eventNumber.classList.add('event-count');
        
            eventTimestamp.innerHTML = eventData.time + ' ';
            eventTimestamp.classList.add('event-timestamp');
        
            eventLeftTitle.appendChild(eventNumber);
            eventLeftTitle.appendChild(eventTimestamp);
            eventLeftTitle.classList.add('event-left-title');
        
            eventSource.innerHTML = cloudEventData.source + ' ';
            eventSource.classList.add('event-source');
        
            eventType.innerHTML = cloudEventData.type + ' ';
            eventType.classList.add('event-type');
        
            eventHeader.appendChild(eventLeftTitle);
            eventHeader.appendChild(eventSource);
            eventHeader.appendChild(eventType);
            if (hasError) {
                eventHeader.classList.add("error");
            }
        
            eventMessage.innerHTML = JSON.stringify(cloudEventData, null, 2);
            eventMessage.style.display = 'none';
        
            eventBox.appendChild(eventHeader);
            eventBox.appendChild(eventMessage);
            eventsStackDiv.prepend(eventBox);
        
            eventHeader.addEventListener('click', function () {
                if (eventMessage.style.display === 'none') {
                    eventMessage.style.display = 'block';
                } else {
                    eventMessage.style.display = 'none';
                }
            });
        }
    };

    const openEventSource = () => {
        console.log("Connection opened");
        sseConnectionStatus.style.backgroundColor = "green";
        sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
    };
    
    const handleSseEvent = (event) => {
        console.log(event);
        incrementEventsCount();
        clearTimeout(sseConnectionTimer);
        sseConnectionStatus.style.backgroundColor = "#4DCEF3" ;
        sseConnectionStatus.style.color = "#1a1d20" ;
        sseConnectionStatus.classList.add('glow');
        sseConnectionStatus.classList.remove('blink');
        sseConnectionStatus.setAttribute("title", "Connected - happy to see some traffic here!");
        
        handleNewEvent(event);

        sseConnectionTimer = setTimeout(() => {
            sseConnectionStatus.style.backgroundColor = "green";
            sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
          }, 10000);
    
        if (eventsStackDiv.childElementCount > eventsCount) {
            let lastEvent = eventsStackDiv.lastChild;
            eventsStackDiv.removeChild(lastEvent);
        }
    };
    
    const handleSseError = () => {
        console.log("Connection error");
        sseConnectionStatus.style.backgroundColor = "#800000";
        sseConnectionStatus.style.color = "#FFF";
        sseConnectionStatus.classList.remove('glow');
        sseConnectionStatus.classList.add('blink');
        sseConnectionStatus.setAttribute("title", "Disconnected... Trying to reconnect every 2s...");
    }

    const init = () => {
        var eventSource = new EventSource(sseEventPath);
        eventSource.addEventListener('open', openEventSource());
        eventSource.addEventListener('message', (event) => {
            handleSseEvent(event);
          });
        eventSource.addEventListener('error', handleSseError());

        sseConnectionStatus.addEventListener('animationend', () => {
            sseConnectionStatus.classList.remove('glow');
            sseConnectionStatus.classList.remove('blink');
        });
    };

    return {
        init,
        resetEventsCount
    }

})()
