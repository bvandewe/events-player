import { sseEventsController } from "../sse/events";

export const confirmDialogController = (() => {

    const deleteAllEvents = () => {
        document.getElementById('confirmModal').style.display='none';
        const events = document.querySelectorAll(".event-box");
        const deletedCount = events.length;
        for (let i = 0; i < deletedCount; i++){
            events[i].remove();
        }
        document.title = "CloudEvents Viewer (0)";
        document.getElementById('event-count').innerHTML = 0;
        sseEventsController.resetEventsCount();
    };

    const init = () => {
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        confirmDeleteBtn.addEventListener('click', deleteAllEvents);
    };

    return {
        init
    }
})();