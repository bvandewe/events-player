import {toastController} from "./toast";
import {taskController} from "../sse/task";

export const generatorForm = (() => {

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
                        taskController.handleTaskStatus(result.task_id), 
                        toastController.showToast(result)
                    ]
                ); 
            })
            .catch(error => {
                console.error('Error submitting form:', error);            
                toastController.showToast(result);
            });
    };

    const init = () => {
        const form = document.getElementById('generatorForm');
        form.addEventListener('submit', (event) => {
            handleSubmit(event);
        });
    };

    return {
        init
    }

})();