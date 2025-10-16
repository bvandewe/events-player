// DataTables initialization for interactive tables
document.addEventListener('DOMContentLoaded', function () {
    // Initialize DataTables on tables with the 'sortable-table' class
    if (typeof $ !== 'undefined' && $.fn.DataTable) {
        $('#port-reservations-table').DataTable({
            "pageLength": 25,
            "lengthMenu": [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
            "order": [[0, "asc"]], // Sort by Port number by default
            "columnDefs": [
                {
                    "targets": [0], // Port column - numeric sort
                    "type": "num"
                },
                {
                    "targets": [1], // Type column - string sort with custom order
                    "type": "string"
                }
            ],
            "dom": 'lfrtip',
            "language": {
                "search": "Filter records:",
                "lengthMenu": "Show _MENU_ entries",
                "info": "Showing _START_ to _END_ of _TOTAL_ port reservations",
                "paginate": {
                    "first": "First",
                    "last": "Last",
                    "next": "Next",
                    "previous": "Previous"
                }
            },
            "searchHighlight": true,
            "responsive": true
        });

        // Add custom search functionality for specific columns
        $('#port-type-filter').on('change', function () {
            var table = $('#port-reservations-table').DataTable();
            var selectedType = $(this).val();

            if (selectedType === '') {
                table.column(1).search('').draw();
            } else {
                table.column(1).search('^' + selectedType + '$', true, false).draw();
            }
        });

        $('#lab-filter').on('change', function () {
            var table = $('#port-reservations-table').DataTable();
            var selectedLab = $(this).val();

            if (selectedLab === '') {
                table.column(2).search('').draw();
            } else {
                table.column(2).search(selectedLab, true, false).draw();
            }
        });

        // Port range filter
        $('#port-range-filter').on('keyup', function () {
            var table = $('#port-reservations-table').DataTable();
            var portRange = $(this).val();

            if (portRange === '') {
                table.column(0).search('').draw();
            } else {
                table.column(0).search(portRange).draw();
            }
        });
    }
});
