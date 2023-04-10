// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

var browser_queue_size = document.querySelector("body").getAttribute("data-browser_queue_size");

// Custom scripts
import { searchController } from "./ui/search";
searchController.init();

import { actionsController } from "./ui/actions";
actionsController.init(bootstrap);

import { sseEventsController } from "./sse/events"
sseEventsController.init(browser_queue_size);

import { keyboardController } from "./keyb-nav"
keyboardController.init(bootstrap);

import {toastController} from "./ui/toast";
toastController.init(bootstrap);

import { generatorForm } from "./ui/generatorForm"
generatorForm.init();

// import { confirmDialogController } from "./ui/confirmDialog"
// confirmDialogController.init();

