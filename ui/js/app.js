// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

// Custom scripts
// import { navController } from "./ui/nav";
// navController.init();

// import { customSelectController } from "./ui/customSelect";
// customSelectController.init();

import { sseEventsController } from "./sse/events"
sseEventsController.init();

import { keyboardController } from "./keyb-nav"
keyboardController.init();

import {toastController} from "./ui/toast";
toastController.init(bootstrap);

import { generatorForm } from "./ui/generatorForm"
generatorForm.init();

// import { confirmDialogController } from "./ui/confirmDialog"
// confirmDialogController.init();

