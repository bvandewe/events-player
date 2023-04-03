// var count = 0;
// let maxQueueSize = document.querySelector('.container').getAttribute('data-browser_queue_size');
import { count, globals } from "./globals.js";




var eventsStackDiv = document.getElementById('events-stack');
var eventCount = document.getElementById('event-count');

var infoButton = document.getElementById("info-button");
var toggleButton = document.getElementById('toggle-button');
var filterInput = document.getElementById('filter-input');

var sseConnectionStatus = document.getElementById('sseConnectionStatus');
sseConnectionStatus.style.backgroundColor = "none" ;

var sseConnectionTimer;

eventSource.onopen = function(event){
    sseConnectionStatus.style.backgroundColor = "green";
    sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
}

eventSource.onmessage = function (event) {
    console.log(event);
    clearTimeout(sseConnectionTimer);
    sseConnectionStatus.style.backgroundColor = "#4DCEF3" ;
    sseConnectionStatus.style.color = "#1a1d20" ;
    sseConnectionStatus.classList.add('glow');
    sseConnectionStatus.classList.remove('blink');
    sseConnectionStatus.setAttribute("title", "Connected - happy to see some traffic here!");

    globals.count++;
    eventCount.innerHTML = globals.count;
    document.title = "CloudEvents Viewer (" + globals.count + ")";

    var eventData = JSON.parse(event.data.replace(/'/g, "\""));    
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

    eventNumber.innerHTML = '#' + globals.count + ' ';
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

    sseConnectionTimer = setTimeout(() => {
        sseConnectionStatus.style.backgroundColor = "green";
        sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
      }, 10000);

    if (eventsStackDiv.childElementCount > globals.maxQueueSize) {
        let lastEvent = eventsStackDiv.lastChild;
        eventsStackDiv.removeChild(lastEvent);
    }
};

eventSource.onerror = function (event) {
    sseConnectionStatus.style.backgroundColor = "#800000";
    sseConnectionStatus.style.color = "#FFF";
    sseConnectionStatus.classList.remove('glow');
    sseConnectionStatus.classList.add('blink');
    sseConnectionStatus.setAttribute("title", "Disconnected... Trying to reconnect every 2s...");
}

sseConnectionStatus.addEventListener('animationend', () => {
    sseConnectionStatus.classList.remove('glow');
    sseConnectionStatus.classList.remove('blink');
});


function onFilterInputChange() {
    var filterValue = filterInput.value.toLowerCase();
    var eventMessages = eventsStackDiv.getElementsByClassName('event-box');
    for (var i = 0; i < eventMessages.length; i++) {
        var text = eventMessages[i].textContent || eventMessages[i].innerText;
        if (text.toLowerCase().indexOf(filterValue) > -1) {
            eventMessages[i].style.display = '';
        } else {
            eventMessages[i].style.display = 'none';
        }
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
function toggleGeneratorModal(){
    var generatorModal = document.getElementById("generatorModal");
    if (generatorModal.style.height === "" || generatorModal.style.height === "0px"){
        generatorModal.style.height = "650px";
    } else {
        generatorModal.style.height = "0px";
    }
}

function toggleSendButton(){
    var sendButton = document.getElementById("send-button");
    if (sendButton.disabled) {
        sendButton.disabled = false;
        const styles = getComputedStyle(button);
    } else {
        sendButton.disabled = true;
        const styles = getComputedStyle(button);
    }
}

// Generator Form
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
            Promise.all([handleTaskStatus(result.task_id), showToast(result)]); 
        })
        .catch(error => {
            console.error('Error submitting form:', error);            
            showToast(result);
        });
}



// Toast
function showToast(result) {
    console.log(result);
    var toast = document.querySelector('.toast-message');
    if (Array.isArray(result.detail)) {
        toast.classList.add('error');
        console.log(result.detail[0].msg);
        // toast.innerHTML = JSON.stringify(result.detail);
        toast.innerHTML = "<strong>" + result.detail[0].msg + " in " + result.detail[0].loc.join(", ") + "</strong>";
    } else {
        toast.classList.add("success");
        toast.innerHTML = result.message;
    }
    toast.classList.add('show');
    setTimeout(function () {
        toast.classList.remove('show');
        toast.classList.remove('error');
        toast.classList.remove('success');
    }, 5000);
}


function updateProgressBar(taskId, progress) {
    const progressBar = document.getElementById(taskId);
    progressBar.style.width = `${progress}%`;
}

// Open Task Status stream
function handleTaskStatus(task_id){
    var progressBarContainer = document.getElementById('progress-bar-container');
    var progressBar = document.createElement('div');
    progressBar.classList.add("progress-bar");
    progressBar.setAttribute('id', task_id);
    progressBarContainer.appendChild(progressBar);
    var taskId = task_id;
    console.log("Handling Task " + taskId + " progress...");
    var taskSource = new EventSource('/stream/task/'+taskId);
    taskSource.onmessage = function (event) {
        // console.log(event);
        var eventData = JSON.parse(event.data.replace(/'/g, "\""));
        updateProgressBar(taskId, eventData.progress);
        if (eventData.progress === -1){
            console.log("Closing task streaming.");
            taskSource.close();
            progressBar.remove();
        }
    }

}



// HELP MODAL
var helpModal = document.getElementById("helpModal");
var helpBtn = document.getElementById("help-button");
var span = document.getElementsByClassName("close")[0];

helpBtn.onclick = function() {
  helpModal.style.display = "block";
}
span.onclick = function() {
  helpModal.style.display = "none";
}
window.onclick = function(event) {
  if (event.target == helpModal) {
    helpModal.style.display = "none";
  }
  if (event.target == confirmModal) {
    confirmModal.style.display = "none";
  }
}


// CONFIRM MODAL
var confirmModal = document.getElementById('confirmModal');

function toggleConfirmModal(){
    if (confirmModal.style.display === "" || confirmModal.style.display === "none"){
        if( document.querySelectorAll(".event-box").length > 0 ){
            confirmModal.style.display='block';
        }
    } else {
        confirmModal.style.display='none';
    }
}

function deleteAllEvents(){
    const events = document.querySelectorAll(".event-box");
    const deletedCount = events.length;
    for (let i = 0; i < deletedCount; i++){
        events[i].remove();
    }
    document.getElementById('confirmModal').style.display='none';
    document.title = "CloudEvents Viewer (0)";
    document.getElementById('event-count').innerHTML = 0;
    globals.count = 0;
}

// 

import "./keyb-nav.js"