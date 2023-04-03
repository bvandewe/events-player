import { navController } from "./ui/nav";
navController.init();

import { customSelectController } from "./ui/customSelect";
customSelectController.init();

import { sseEventsController } from "./sse/events"
sseEventsController.init();

import { keyboardController } from "./keyb-nav"
keyboardController.init();

import { generatorForm } from "./ui/generatorForm"
generatorForm.init();

import { confirmDialogController } from "./ui/confirmDialog"
confirmDialogController.init();
