export const navController = (() => {

    const confirmClearEvents = () => {
        // if there are events, show Confirmation dialog when clicking on the Viewer nav button
        var confirmModal = document.getElementById('confirmModal');
        if (confirmModal.style.display === "" || confirmModal.style.display === "none"){
            if( document.querySelectorAll(".event-box").length > 0 ){
                confirmModal.style.display='block';
            }
        } else {
            confirmModal.style.display='none';
        }
    };

    const toggleGeneratorModal = () => {
        var generatorModal = document.getElementById("generatorModal");
        if (generatorModal.style.height === "" || generatorModal.style.height === "0px"){
            generatorModal.style.height = "650px";
        } else {
            generatorModal.style.height = "0px";
        }
    };

    const toggleEventDetails = () => {
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
    };

    const openSwaggerUI = () => {
        window.open("/api/docs", "_blank");

    };

    const openHelpModal = () => {
        var helpModal = document.getElementById("helpModal");
        helpModal.style.display = "block";
    };
    
    const closeHelpModal = () => {
        var helpModal = document.getElementById("helpModal");
        helpModal.style.display = "none";
    };

    const dismissHelpModal = (event) => {
        var helpModal = document.getElementById("helpModal");
        if (event.target == helpModal) {
            helpModal.style.display = "none";
        }
    };

    const onFilterInputChange = (event) => {
        event.preventDefault();
        var filterInput = document.getElementById('filter-input');
        var filterValue = filterInput.value.toLowerCase();
        var eventsStackDiv = document.getElementById('events-stack');
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

    const init = () => {
        const viewerButton = document.getElementById("viewerNav");
        viewerButton.addEventListener('click', confirmClearEvents);
        const generatorButton = document.getElementById("generatorNav");
        generatorButton.addEventListener('click', toggleGeneratorModal);
        var closeGeneratorButton = document.getElementsByClassName("generatorClose")[0];
        closeGeneratorButton.addEventListener('click', toggleGeneratorModal);
        const toggleButton = document.getElementById('toggle-button');
        toggleButton.addEventListener('click', toggleEventDetails);
        var infoButton = document.getElementById("info-button");
        infoButton.addEventListener('click', openSwaggerUI);
        var helpBtn = document.getElementById("help-button");
        helpBtn.addEventListener('click', openHelpModal);
        var closeHelpModalButton = document.getElementsByClassName("modal-close")[0];
        closeHelpModalButton.addEventListener('click', closeHelpModal);
        window.addEventListener('click', dismissHelpModal);
        var filterInput = document.getElementById('filter-input');
        filterInput.addEventListener('keyup', onFilterInputChange);
    }

    return {        
        init
    };

})();