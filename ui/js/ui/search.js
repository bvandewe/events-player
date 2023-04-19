export const searchController = (() => {

    const onFilterInputChange = (event) => {
        event.preventDefault();
        var filterInput = document.getElementById('search-input');
        var filterValue = filterInput.value.toLowerCase();
        var eventsStackDiv = document.getElementById('events-stack');
        var eventMessages = eventsStackDiv.getElementsByClassName('accordion-item');
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
        var filterInput = document.getElementById('search-input');
        filterInput.addEventListener('keyup', onFilterInputChange);
        var searchForm = document.getElementById('search-form');
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
        });
    };

return {
    init
}

})();
