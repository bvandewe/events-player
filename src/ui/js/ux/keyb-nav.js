//Keyboard Shortcuts
export const keyboardController = (() => {
    var bootstrap;
    let generatorOffcanvas = null;

    const init = bs => {
        bootstrap = bs;

        // Initialize offcanvas instances
        const generatorPanel = document.getElementById('generatorPanel');

        if (generatorPanel) {
            generatorOffcanvas = new bootstrap.Offcanvas(generatorPanel);
        }

        document.addEventListener('keydown', function (event) {
            // console.log(event.key);
            //event.stopPropagation();

            // Note: Escape key is handled by Bootstrap via data-bs-keyboard="true"
            // No custom Escape handler needed

            // Control - Toggle generator panel
            if (event.key === 'Control' || (event.metaKey && event.key === 'ArrowUp')) {
                // Check if user has access to generator
                if (window.generatorAccessDenied) {
                    console.log('[Keyboard] Generator access denied for current user');
                    return;
                }

                if (generatorOffcanvas) {
                    if (generatorPanel.classList.contains('show')) {
                        generatorOffcanvas.hide();
                    } else {
                        generatorOffcanvas.show();
                    }
                }
                event.preventDefault();
            }

            // Meta+f - Focus/unfocus search input
            if (event.metaKey && event.key === 'f') {
                var filterInput = document.getElementById('search-input');
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
            if (event.metaKey && event.key === '/') {
                const myModal = new bootstrap.Modal('#helpModal');
                myModal.show();
            }
        });
    };

    return {
        init,
    };
})();
