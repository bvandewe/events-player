var count = 0;
var eventSource = new EventSource('/stream');

var eventsStackDiv = document.getElementById('events-stack');
var eventCount = document.getElementById('event-count');
var infoButton = document.getElementById("info-button");
var toggleButton = document.getElementById('toggle-button');
var filterInput = document.getElementById('filter-input');

eventSource.onmessage = function (event) {
    count++;
    eventCount.innerHTML = count;
    document.title = "CloudEvents Viewer (" + count + ")";

    var eventData = JSON.parse(event.data.replace(/'/g, "\""));
    console.log(eventData);
    var cloudEventData = eventData.cloudevent;

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

    eventNumber.innerHTML = '#' + count + ' ';
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
};

function filterResults() {
    var filterValue = filterInput.value.toLowerCase();
    var eventMessages = eventsStackDiv.getElementsByClassName('event-box');
    for (var i = 0; i < eventMessages.length; i++) {
        var text = eventMessages[i].innerText.toLowerCase();
        if (text.indexOf(filterValue) > -1) {
            eventMessages[i].style.display = '';
        } else {
            eventMessages[i].style.display = 'none';
        }
    }
};
function onFilterInputChange(event) {
    event.preventDefault();
    if (event.keyCode === 13) {
        filterResults(event.target.value);
    }
};

function toggleAll() {
    var cloudeventMessages = document.getElementsByClassName('event-message');
    var toggleIcon = document.getElementById('toggle-icon');
    if (toggleIcon.classList.contains('fa-caret-up')) {
        toggleIcon.classList.remove('fa-caret-up');
        toggleIcon.classList.add('fa-caret-down');
    } else {
        toggleIcon.classList.remove('fa-caret-down');
        toggleIcon.classList.add('fa-caret-up');
    }
    for (var i = 0; i < cloudeventMessages.length; i++) {
        if (cloudeventMessages[i].style.display === 'none') {
            cloudeventMessages[i].style.display = 'block';
        } else {
            cloudeventMessages[i].style.display = 'none';
        }
    }
}

filterInput.addEventListener('keyup', onFilterInputChange);
toggleButton.addEventListener('click', toggleAll);
infoButton.addEventListener("click", function () {
    window.open("/api/docs", "_blank")
});

// Generator Modal
function openNav() {
    document.getElementById("generatorModal").style.height = "650px";
}
function closeNav() {
    document.getElementById("generatorModal").style.height = "0";
}

// Toast
function showToast(result) {
    console.log(result);
    var toast = document.querySelector('.toast-message');
    if (Array.isArray(result.detail)) {
        console.log("ERROR!!");
        toast.classList.add('error');
        toast.innerHTML = JSON.stringify(result.detail);
    } else {
        toast.classList.add("success");
        toast.innerHTML = result.message;
    }
    toast.classList.add('show');
    setTimeout(function () {
        toast.classList.remove('show');
        toast.classList.remove('error');
        toast.classList.remove('success');
    }, 4000);
}


const form = document.getElementById('generatorForm');
form.addEventListener('submit', handleSubmit);

function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    console.log(data);
    fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            console.log('Form submitted successfully:', result);
            showToast(result);
        })
        .catch(error => {
            console.error('Error submitting form:', error);
            showToast(result);
        });
}