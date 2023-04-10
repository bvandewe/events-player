import {toastController} from "./toast";
import {taskController} from "../sse/task";

export const generatorForm = (() => {

    const initSliders = () => {
        
        var eventIterations = document.getElementById("eventIterations");
        var eventIterationsValue = document.getElementById("eventIterationsValue");
        eventIterations.addEventListener("input", function() {
            var selectedValue = eventIterations.value;
            eventIterationsValue.innerHTML = selectedValue;
        });
        
        var eventDelay = document.getElementById("eventDelay");
        var eventDelayValue = document.getElementById("eventDelayValue");
        eventDelay.addEventListener("input", function() {
            var selectedValue = eventDelay.value;
            eventDelayValue.innerHTML = selectedValue;
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        console.log(data);
        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                console.log('Form submitted successfully:', result);
                Promise.all(
                    [
                        console.log(result),
                        taskController.handleTaskStatus(result.task_id), 
                        toastController.showToast(result)
                    ]
                ); 
            })
            .catch(error => {
                console.error('Error submitting form:', error);            
                // toastController.showToast(result);
            });
    };

    const init = () => {

        initSliders();
        
        const form = document.getElementById('generatorForm');
        form.addEventListener('submit', (event) => {
            handleSubmit(event);
        });
    };

    return {
        init
    }

})();
