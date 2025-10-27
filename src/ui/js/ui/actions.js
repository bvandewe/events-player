import { sseEventsController } from "../sse/events";

export const actionsController = (() => {
    var bootstrap;
    var confirmModal;

    const toggleEventDetails = () => {
        var cloudeventMessages = document.getElementsByClassName('accordion-collapse');
        var toggleLink = document.getElementById('expandCollapseLink');
        var toggleIcon = document.getElementById('expandCollapseIcon');

        // Defensive check - if elements don't exist, do nothing
        if (!toggleLink || !toggleIcon) {
            return;
        }

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
        if (events.length > 0) {
            confirmModal.show();
        }
    };

    const deleteAllEvents = () => {
        if (typeof confirmModal !== "undefined") {
            var events = document.getElementsByClassName('accordion-item');
            const eventsArray = Array.from(events);
            for (var i = 0; i < eventsArray.length; i++) {
                eventsArray[i].remove();
            };
            document.title = "CloudEvents Viewer (0)";
            document.getElementById('event-count').innerHTML = 0;
            sseEventsController.resetEventsCount();
            confirmModal.hide();
        }
    };

    const toggleFiltersPanel = () => {
        const filtersPanel = document.getElementById('filtersPanel');
        const toggleIcon = document.getElementById('toggleFiltersIcon');
        const toggleText = document.getElementById('toggleFiltersText');

        if (filtersPanel.style.display === 'none') {
            // Show filters
            filtersPanel.style.display = '';
            toggleIcon.classList.remove('bi-funnel-fill');
            toggleIcon.classList.add('bi-funnel');
            toggleText.textContent = 'Hide Filters';
        } else {
            // Hide filters
            filtersPanel.style.display = 'none';
            toggleIcon.classList.remove('bi-funnel');
            toggleIcon.classList.add('bi-funnel-fill');
            toggleText.textContent = 'Show Filters';
        }
    };

    const init = (bs) => {
        bootstrap = bs;

        var expandCollapse = document.getElementById('expandCollapseLink');
        if (expandCollapse) {
            expandCollapse.addEventListener('click', toggleEventDetails);
        }

        var deleteAllEventsBtn = document.getElementById('deleteAllEventsBtn');
        if (deleteAllEventsBtn) {
            deleteAllEventsBtn.addEventListener('click', deleteAllEvents);
        }

        var toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', toggleFiltersPanel);
        }
    };

    return {
        init
    }

})();
