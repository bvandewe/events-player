//Keyboard Shortcuts
export const keyboardController = (() => {

    const init = () => {
        document.addEventListener("keydown", function (event) {
            //console.log(event.key);
            //event.stopPropagation();
            if (event.key === "Escape" || (event.metaKey && event.key === "ArrowDown")) {
                document.getElementById("generatorModal").style.height = "0";
                document.getElementById("helpModal").style.display = "none";
            }
            if (event.key === "Control" || (event.metaKey && event.key === "ArrowUp")) {
                document.getElementById("generatorModal").style.height = "650px";
            }
            if ( event.metaKey && event.key === "f" ) {
                var filterInput = document.getElementById("filter-input");        
                if (document.activeElement === filterInput) {
                    document.activeElement.blur();
                    event.preventDefault();
                } else {
                    document.activeElement.blur();
                    filterInput.focus();
                    event.preventDefault();
                }
            }
        });
    };

    return {        
        init
    };

})()
