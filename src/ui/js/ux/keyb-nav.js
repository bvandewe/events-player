//Keyboard Shortcuts
export const keyboardController = (() => {
    var bootstrap;
    let generatorOffcanvas = null;
    let filtersOffcanvas = null;

    const init = (bs) => {
        bootstrap = bs;

        // Initialize offcanvas instances
        const generatorPanel = document.getElementById("generatorPanel");
        const filtersPanel = document.getElementById("filtersPanel");

        if (generatorPanel) {
            generatorOffcanvas = new bootstrap.Offcanvas(generatorPanel);
        }

        if (filtersPanel) {
            filtersOffcanvas = new bootstrap.Offcanvas(filtersPanel);
        }

        document.addEventListener("keydown", function (event) {
            // console.log(event.key);
            //event.stopPropagation();

            // Note: Escape key is handled by Bootstrap via data-bs-keyboard="true"
            // No custom Escape handler needed

            // Control - Toggle generator panel
            if (event.key === "Control" || (event.metaKey && event.key === "ArrowUp")) {
                // Check if user has access to generator
                if (window.generatorAccessDenied) {
                    console.log('[Keyboard] Generator access denied for current user');
                    return;
                }

                if (generatorOffcanvas) {
                    if (generatorPanel.classList.contains("show")) {
                        generatorOffcanvas.hide();
                    } else {
                        generatorOffcanvas.show();
                    }
                }
                event.preventDefault();
            }

            // Alt/Option - Toggle filter panel
            if (event.key === "Alt") {
                if (filtersOffcanvas) {
                    if (filtersPanel.classList.contains("show")) {
                        filtersOffcanvas.hide();
                    } else {
                        filtersOffcanvas.show();
                    }
                }
                event.preventDefault();
            }

            // Meta+f - Focus/unfocus search input
            if (event.metaKey && event.key === "f") {
                var filterInput = document.getElementById("search-input");
                if (document.activeElement === filterInput) {
                    document.activeElement.blur();
                    event.preventDefault();
                } else {
                    document.activeElement.blur();
                    filterInput.focus();
                    event.preventDefault();
                }
            }

            // Meta+/ - Open help modal
            if (event.metaKey && event.key === "/") {
                const myModal = new bootstrap.Modal('#helpModal');
                myModal.show();
            }
        });
    };

    return {
        init
    };

})()
