document$.subscribe(function () {
    // Initialize tablesort for all tables without a specific class
    var tables = document.querySelectorAll("article table:not([class])")
    tables.forEach(function (table) {
        new Tablesort(table)
    })

    // Also initialize for tables with sortable class
    var sortableTables = document.querySelectorAll("table.sortable")
    sortableTables.forEach(function (table) {
        new Tablesort(table)
    })
})
