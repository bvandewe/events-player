import { progressBarController } from "../ui/progressBar";

export const taskController = (() => {

    const handleTaskStatus = (task_id) => {
        var progressBarContainer = document.getElementById('task-progress-bar-container');
        progressBarContainer.style.height = "5px";
        // var progressBar = document.createElement('div');
        // progressBar.classList.add("progress-bar");
        // progressBar.setAttribute('id', task_id);
        // progressBarContainer.appendChild(progressBar);
        var progressBar = document.getElementById('task-progress-bar');
        var taskId = task_id;
        console.log("Handling Task " + taskId + " progress...");
        var taskSource = new EventSource('/stream/task/'+taskId);
        taskSource.onmessage = function (event) {
            // console.log(event);
            var eventData = JSON.parse(event.data.replace(/'/g, "\""));
            // progressBarController.updateProgressBar(taskId, eventData.progress);
            progressBar.style.width = eventData.progress + "%";
            if (eventData.progress === -1){
                console.log("Closing task streaming.");
                taskSource.close();
                progressBar.style.width = 0 + "%";
                progressBarContainer.style.height = "0px";
            }
        }
    };

    return {
        handleTaskStatus
    }

})();