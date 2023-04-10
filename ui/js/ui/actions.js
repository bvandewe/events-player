import { sseEventsController } from "../sse/events";

export const actionsController = (() => {
    var bootstrap;
    var confirmModal;

    const toggleEventDetails = () => {
        var cloudeventMessages = document.getElementsByClassName('accordion-collapse');
        var toggleLink = document.getElementById('expandCollapseLink');
        var toggleIcon = document.getElementById('expandCollapseIcon');

        if (toggleIcon.classList.contains('bi-caret-down-fill')) {
            toggleIcon.classList.remove('bi-caret-down-fill');
            toggleIcon.classList.add('bi-caret-up-fill');
            toggleLink.innerText = 'Expand all';
            toggleLink.appendChild(toggleIcon)

        } else {
            toggleIcon.classList.remove('bi-caret-up-fill');
            toggleIcon.classList.add('bi-caret-down-fill');
            toggleLink.innerText = 'Collapse all';
            toggleLink.appendChild(toggleIcon)
        }

        for (var i = 0; i < cloudeventMessages.length; i++) {
            var item = new bootstrap.Collapse(cloudeventMessages[i]);
            item.hide();
        }

    };


    const confirmClearEvents = () => {
        // if there are events, show Confirmation dialog when clicking on the Viewer nav button
        var clearListLink = document.getElementById('clearListLink');
        confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'))
        const events = document.getElementsByClassName("accordion-item");
        console.log(`Deleting ${events.length} events`);
        if( events.length > 0 ){
            confirmModal.show();
        }
    };

    const deleteAllEvents = () => {
        if (typeof confirmModal !== "undefined"){
            var events = document.getElementsByClassName('accordion-item');
            const eventsArray = Array.from(events);
            for (var i = 0; i < eventsArray.length; i++){
                eventsArray[i].remove();
            };
            document.title = "CloudEvents Viewer (0)";
            document.getElementById('event-count').innerHTML = 0;
            sseEventsController.resetEventsCount();
            confirmModal.hide();
        }
    };

    const init = (bs) => {
        bootstrap = bs;

        var expandCollapse = document.getElementById('expandCollapseLink');
        expandCollapse.addEventListener('click', toggleEventDetails);

        var clearListLink = document.getElementById('clearListLink');
        clearListLink.addEventListener('click', confirmClearEvents);
        
        var deleteAllEventsBtn = document.getElementById('deleteAllEventsBtn');
        deleteAllEventsBtn.addEventListener('click', deleteAllEvents);

    };

return {
    init
}

})();
