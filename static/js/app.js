var count = 0;
let maxQueueSize = document.querySelector('.container').getAttribute('data-browser_queue_size');
var eventSource = new EventSource('/stream/events');

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

    count++;
    eventCount.innerHTML = count;
    document.title = "CloudEvents Viewer (" + count + ")";

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

    sseConnectionTimer = setTimeout(() => {
        sseConnectionStatus.style.backgroundColor = "green";
        sseConnectionStatus.setAttribute("title", "Connected - its quiet here though!");
      }, 10000);

    if (eventsStackDiv.childElementCount > maxQueueSize) {
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
            handleTaskStatus(result.task_id);
            showToast(result);
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


function updateProgressBar(progress) {
    const progressBar = document.querySelector('.progress-bar');
    progressBar.style.width = `${progress}%`;
}


// Open Task Status stream
function handleTaskStatus(task_id){
    var taskId = task_id;
    console.log("Handling Task " + taskId + " progress...");
    var taskSource = new EventSource('/stream/task/'+taskId);
    taskSource.onmessage = function (event) {
        console.log(event);
        var eventData = JSON.parse(event.data.replace(/'/g, "\""));
        updateProgressBar(eventData.progress);
        if (eventData.progress === -1){
            console.log("Closing task streaming.");
            taskSource.close();
            updateProgressBar(0);
        }
    }

}


// CUSTOM SELECT
// https://www.w3schools.com/howto/howto_custom_select.asp
var x, i, j, l, ll, selElmnt, a, b, c;
/* Look for any elements with the class "custom-select": */
x = document.getElementsByClassName("custom-select");
l = x.length;
for (i = 0; i < l; i++) {
  selElmnt = x[i].getElementsByTagName("select")[0];
  ll = selElmnt.length;
  /* For each element, create a new DIV that will act as the selected item: */
  a = document.createElement("DIV");
  a.setAttribute("class", "select-selected");
  a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
  x[i].appendChild(a);
  /* For each element, create a new DIV that will contain the option list: */
  b = document.createElement("DIV");
  b.setAttribute("class", "select-items select-hide");
  for (j = 1; j < ll; j++) {
    /* For each option in the original select element,
    create a new DIV that will act as an option item: */
    c = document.createElement("DIV");
    c.innerHTML = selElmnt.options[j].innerHTML;
    c.addEventListener("click", function(e) {
        /* When an item is clicked, update the original select box,
        and the selected item: */
        var y, i, k, s, h, sl, yl;
        s = this.parentNode.parentNode.getElementsByTagName("select")[0];
        sl = s.length;
        h = this.parentNode.previousSibling;
        for (i = 0; i < sl; i++) {
          if (s.options[i].innerHTML == this.innerHTML) {
            s.selectedIndex = i;
            h.innerHTML = this.innerHTML;
            y = this.parentNode.getElementsByClassName("same-as-selected");
            yl = y.length;
            for (k = 0; k < yl; k++) {
              y[k].removeAttribute("class");
            }
            this.setAttribute("class", "same-as-selected");
            break;
          }
        }
        h.click();
    });
    b.appendChild(c);
  }
  x[i].appendChild(b);
  a.addEventListener("click", function(e) {
    /* When the select box is clicked, close any other select boxes,
    and open/close the current select box: */
    e.stopPropagation();
    closeAllSelect(this);
    this.nextSibling.classList.toggle("select-hide");
    this.classList.toggle("select-arrow-active");
  });
}

function closeAllSelect(elmnt) {
  /* A function that will close all select boxes in the document,
  except the current select box: */
  var x, y, i, xl, yl, arrNo = [];
  x = document.getElementsByClassName("select-items");
  y = document.getElementsByClassName("select-selected");
  xl = x.length;
  yl = y.length;
  for (i = 0; i < yl; i++) {
    if (elmnt == y[i]) {
      arrNo.push(i)
    } else {
      y[i].classList.remove("select-arrow-active");
    }
  }
  for (i = 0; i < xl; i++) {
    if (arrNo.indexOf(i)) {
      x[i].classList.add("select-hide");
    }
  }
}
document.addEventListener("click", closeAllSelect);
// CUSTOM SELECT


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
    count = 0;
}

