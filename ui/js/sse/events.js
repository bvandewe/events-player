import {toastController} from "../ui/toast";
import { v4 as uuidv4 } from 'uuid';

export const sseEventsController = (() => {
    
    const sseEventPath = '/stream/events';
    var sseConnectionStatus = document.getElementById('connectionStatusIndicator');
    var eventsStack = document.getElementById('events-stack');
    var eventsCount = 0;
    var maxQueueSize = 0;
    var sseConnectionTimer;

    const createAccordionItem = ({eventCount, timestamp, hasError, eventSource, eventType, eventData, eventId }) => {

        // create the div element with class "accordion-item"
        const accordionItem = document.createElement('div');
        accordionItem.classList.add('accordion-item');

        // create the h2 element with class "accordion-header"
        const accordionHeader = document.createElement('h2');
        accordionHeader.classList.add('accordion-header');

        // create the button element with classes "accordion-button" and "collapsed", and set its attributes
        const button = document.createElement('button');
        button.classList.add('accordion-button', 'collapsed');
        button.type = 'button';
        button.setAttribute('data-bs-toggle', 'collapse');
        button.setAttribute('data-bs-target', `#${eventId}`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `${eventId}`);

        // create the first span element with classes "me-2" and "align-middle", and set its text content
        const span1 = document.createElement('span');
        span1.classList.add('me-2', 'align-middle');
        span1.textContent = `#${eventCount}`;

        // create the second span element with classes "align-middle" and "text-secondary", and set its text content
        const span2 = document.createElement('span');
        span2.classList.add('align-middle', 'text-secondary');
        span2.textContent = `${timestamp}`;
        
        // create the badge element with class "bg-info ms-2", and set its text content
        var badgeText;
        var badgeColor;

        switch (hasError) {
            case "none": 
                badgeText = "Plain JSON";
                badgeColor = "success";
            break;

            case "backend-error":
                badgeText = "Invalid JSON";
                badgeColor = "danger";
            break;

            case "parse-error":
                badgeText = "Escaped JSON";
                badgeColor = "warning";
            break;

            default:
            break;
        }
        
        const badge = document.createElement('span');
        badge.classList.add('badge', `text-bg-${badgeColor}`, 'ms-2', 'p-1');
        badge.textContent = badgeText;

        // append the badge element to the second span element
        span2.appendChild(badge);

        // create the third span element with classes "mx-auto", "align-middle", and "text-info-emphasis", and set its text content
        const span3 = document.createElement('span');
        span3.classList.add('mx-auto', 'align-middle', 'text-info-emphasis');
        span3.textContent = `${eventType}`;

        // create the fourth span element with classes "ms-auto", "fs-5", and "align-middle", and set its text content
        const span4 = document.createElement('span');
        span4.classList.add('ms-auto', 'fs-5', 'align-middle');

        // create the badge element with class "bg-secondary", and set its text content
        const badge2 = document.createElement('span');
        badge2.classList.add('badge', 'bg-secondary', 'p-1');
        badge2.textContent = `${eventSource}`;

        // append the badge element to the fourth span element
        span4.appendChild(badge2);

        // append the span elements to the button element
        button.appendChild(span1);
        button.appendChild(span2);
        button.appendChild(span3);
        button.appendChild(span4);

        // append the button element to the h2 element
        accordionHeader.appendChild(button);

        // create the div element with classes "accordion-collapse" and "collapse", and set its attributes
        const accordionCollapse = document.createElement('div');
        accordionCollapse.classList.add('accordion-collapse', 'collapse');
        accordionCollapse.setAttribute('id', `${eventId}`);

        // create the div element with class "accordion-body" and set its text content
        const accordionBody = document.createElement('div');
        accordionBody.classList.add('accordion-body', 'eventData');
        accordionBody.textContent = JSON.stringify(eventData, null, 2);
        
        // append the accordionBody element to the accordionCollapse element
        accordionCollapse.appendChild(accordionBody);

        // append the accordionHeader and accordionCollapse elements to the accordionItem element
        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionCollapse);

        return accordionItem;
    };

    const resetEventsCount = () => {
        eventsCount = 0;
    };

    const incrementEventsCount = () => {
        var eventCountSpan = document.getElementById('event-count');
        eventsCount++;
        eventCountSpan.innerHTML = eventsCount;
        document.title = "CloudEvents Viewer (" + eventsCount + ")";
    };

    const handleConnectionStatus = (status) => {
        switch (status) {
            case "open":
                console.log("Connection opened");
                sseConnectionStatus.style.backgroundColor = "green";
                sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");        
            case "connect": 
                sseConnectionStatus.style.backgroundColor = "#4DCEF3" ;
                sseConnectionStatus.style.color = "#1a1d20" ;
                sseConnectionStatus.classList.add('glow');
                sseConnectionStatus.classList.remove('blink');
                sseConnectionStatus.setAttribute("title", "Connected - happy to see some traffic here!");    
                break;
            case "error": 
                console.log("Connection error");
                sseConnectionStatus.style.backgroundColor = "#800000";
                sseConnectionStatus.style.color = "#FFF";
                sseConnectionStatus.classList.remove('glow');
                sseConnectionStatus.classList.add('blink');
                sseConnectionStatus.setAttribute("title", "Disconnected... Trying to reconnect every 2s...");
                break;
            case "newtimer":
                sseConnectionTimer = setTimeout(() => {
                    sseConnectionStatus.style.backgroundColor = "green";
                    sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
                  }, 10000);
                break;
            case "cleartimer":
                clearTimeout(sseConnectionTimer);
                break;
            default:
                break;
        }
        
    };

    const handleNewEvent = (event) => {
        if ("data" in event){
            var hasError = "none";
            try {
                // Happy path: event.data is parseable
                var eventData = JSON.parse(event.data.replace(/'/g, "\"").replace(/\\\"/g, '"'));
                var cloudEventData = eventData.cloudevent;

                if (typeof cloudEventData.data === 'object') {
                    if (Object.keys(cloudEventData.data).length == 1 && cloudEventData.data.hasOwnProperty('error')) {
                        hasError = "backend-error";
                    }
                }

            } catch (error) {
                // Simulate a Validation Error for now
                hasError = "parse-error";
                var result = {
                    "detail": [
                        {
                            "loc": ["event.data"], 
                            "msg": "Event data is not valid JSON, maybe a JSON object encoded as a String, or including single quotes somewhere?", 
                            "type": "JSON.parse"
                        }
                    ]
                }
                toastController.showToast(result);
                var eventData = event.data.replace(/'/g, "\"").replace(/\\\"/g, '"');
                // Assuming .data is the last attribute in the event... (!!! quite a significant assumption!!)
                // Removing anything after `, "data"` and adding `}}` should make it parsable
                var strippedEventData = eventData.substring(0, eventData.indexOf(", \"data\"")) + "}}";
                // Capturing the raw data
                var eventDataStr = eventData.substring(eventData.indexOf(", \"data\""));
                eventData = JSON.parse(strippedEventData);
                var cloudEventData = eventData.cloudevent;
                // cloudEventData.data = result;
                // Adding the raw string back as "data"
                cloudEventData.data = eventDataStr.substring(9);
            }
            const uuid = uuidv4();
            var accordionData = {
                eventCount: eventsCount,
                timestamp: eventData.time,
                hasError: hasError,
                eventSource: cloudEventData.source,
                eventType: cloudEventData.type,
                eventData: cloudEventData,
                eventId: uuid
            };
            item = createAccordionItem(accordionData);
            eventsStack.prepend(item);
        }
    };
    
    const handleSseEvent = (event) => {
        console.log(event);
        incrementEventsCount();
        handleConnectionStatus("cleartimer");
        handleConnectionStatus("connect");
        handleNewEvent(event);
        handleConnectionStatus("newtimer");

        // Keep the stack to its max-size ??? > eventsCount
        if (eventsStack.childElementCount > maxQueueSize) {
            let lastEvent = eventsStack.lastChild;
            eventsStack.removeChild(lastEvent);
        }
    };
    
    const init = (queueSize) => {
        var eventSource = new EventSource(sseEventPath);
        maxQueueSize = parseInt(queueSize);

        eventSource.addEventListener('open', 
            handleConnectionStatus("open")
        );
        
        eventSource.addEventListener('message', (event) => {
            handleSseEvent(event)
        });
        
        eventSource.addEventListener('error', 
            handleConnectionStatus("error")
        );

        sseConnectionStatus.addEventListener('animationend', () => {
            sseConnectionStatus.classList.remove('glow', 'blink');
        });


    };

    return {
        init,
        resetEventsCount
    }

})();
