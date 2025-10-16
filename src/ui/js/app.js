import * as bootstrap from 'bootstrap'

var browser_queue_size = document.querySelector("body").getAttribute("data-browser_queue_size");

import { searchController } from "./ui/search";
searchController.init();

import { actionsController } from "./ui/actions";
actionsController.init(bootstrap);

import { sseEventsController } from "./sse/events"
sseEventsController.init(browser_queue_size);

import { keyboardController } from "./ux/keyb-nav"
keyboardController.init(bootstrap);

import {toastController} from "./ui/toast";
toastController.init(bootstrap);

import { generatorForm } from "./ui/generatorForm"
generatorForm.init();

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
