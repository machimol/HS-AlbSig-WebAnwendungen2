// Application global variable to keep the websocket reference
let webSocket = null;
// Application global variable to keep all the local guestbook entries
let localGuestbookStore = [];

// Shorthand function for $(document).ready(...);
$(async () => {
    // When the "reloadEntries" button is clicked, fetch the guestbook entries
    $("#reloadEntries").click(async () => await loadGuestbookEntries());

    $('#createEntryButton').click(async () => await createNewGuestbookEntry());

    $('#reconnect-websocket').click(() => connectWebsocket());

    // when the page is done loading, fetch the guestbook entries
    await loadGuestbookEntries();

    connectWebsocket();
});

function connectWebsocket() {
    const url = "ws://localhost:3000/ws/live-updates";
    // Connect to the WebSocket Endpoint
    webSocket = new WebSocket(url);

    // Wire up required event handlers:
    // Handle connection established
    webSocket.onopen = () => {
        console.log("[WebSocket] Connection established");
        $("#websocket-error-message").addClass("d-none");
    };

    // Handle incoming messages
    webSocket.onmessage = (messageEvent) => {
        console.log("[WebSocket] Received message:", messageEvent);
        handleWebSocketMessage(messageEvent);
    };

    const showWebSocketError = () => {
        $("#websocket-error-message").removeClass("d-none");
    };

    // Handle connection closed by server
    webSocket.onclose = () => {
        console.log("[WebSocket] Connection closed");
        showWebSocketError();
    };

    // Handle errors like network failures, etc.
    webSocket.onerror = (errorEvent) => {
        console.log("[WebSocket] Error: ", errorEvent);
        showWebSocketError();
    };
}

function handleWebSocketMessage(messageEvent) {
    // Get the payload from the receieved event
    var receivedData = messageEvent.data;
    // Parse the payload as JSON
    var message = JSON.parse(receivedData);

    if(message.type == "EntryCreated") {
        console.log("Handling EntryCreated message");
        // Get the entry object from the message
        var newEntry = message.createdEntry;
        // Insert the new entry into our local version of the guestbook tore
        localGuestbookStore.push(newEntry);
        // Render the local guestbook tore
        renderGuestbookEntries(localGuestbookStore);
    }
    else if(message.type == "EntryDeleted") {
        console.log("Handling EntryDeleted message");
        // Remove the deleted entry from our local guestbook tore
        localGuestbookStore = localGuestbookStore.filter(
            (entryCandidate) => entryCandidate.id != message.deletedEntryId
        );

        // Render the local guestbook store
        renderGuestbookEntries(localGuestbookStore);
    }
    else {
        // Fallback in case something unexpected happens
        console.log("Received an unknown message.type=" + message.type + "; Dropping message.");
    }
}

async function loadGuestbookEntries() {
    let entries = undefined;
    try {
        const response = await fetch("/api/v1/entries");
        entries = await response.json();
    }
    catch(exception) {
        showError("Failed to fetch guestbook entries", exception);
        return;
    };

    localGuestbookStore = entries;

    renderGuestbookEntries(localGuestbookStore);
}

function renderGuestbookEntries(entries) {
    // Reverse the entries array, we want the newest entries on top
    entries = entries.reverse();

    const entriesContainer = $('#guestbookEntriesContainer');
    // Make sure the container is empty.
    entriesContainer.empty();

    if(entries.length == 0) {
        // Tell the user there are no entries.
        const noEntriesInfo = $('<div class="alert alert-info" />');
        noEntriesInfo.text("Keine Einträge im Gästebuch vorhanden");
        entriesContainer.append(noEntriesInfo);
        return;
    }

    entries.forEach((entry) => {
        const newEntry = renderEntry(entry);
        entriesContainer.append(newEntry);
    });
}

function renderEntry(entry) {
    const card = $('<div class="card" id="' + entry.id + '"/>');
    const cardHeader = $('<div class="card-header" />');
    cardHeader.text("Eintrag #" + entry.id + " von " + entry.name + " am " + entry.date);
    const deleteButton = $('<button data-id="' + entry.id + '" class="btn btn-sm btn-danger float-right delete-button">Löschen</button>');
    deleteButton.click(async (clickedButtonEvent) => deleteEntry(clickedButtonEvent));
    cardHeader.append(deleteButton);

    card.append(cardHeader);

    const cardBody = $('<div class="card-body" />');
    // This allows HTML Injection! Demo purpose only! Better use .text()!
    cardBody.html(entry.text);
    card.append(cardBody);

    return card;
}

async function createNewGuestbookEntry() {
    const newEntryModal = $('#newEntryModal');
    const newEntryForm = $('form', newEntryModal).first();

    const nameInput = $('input[name="name"]', newEntryForm);
    const textInput = $('textarea[name="text"]', newEntryForm);

    const newEntry = {
        name: nameInput.val(),
        text: textInput.val(),
    };

    // Send the new entry via HTTP POST to the API
    var response = await fetch('/api/v1/entries', {
        method: "POST",
        headers: {
                "Content-Type": "application/json",
        },
        body: JSON.stringify(newEntry),
    });

    // In case something went wrong, show an error
    if(response.status != 200) {
        showError("Failed to create new Guestbook entry!");
        return;
    }

    // Reset the input fields
    textInput.val("");
    nameInput.val("");

    // Hide the newEntryModal
    newEntryModal.modal("hide");
}

async function deleteEntry(clickedButtonEvent) {
    const clickedButton = $(clickedButtonEvent.currentTarget);
    const entryIdToDelete = clickedButton.attr("data-id");

    const response = await fetch("/api/v1/entries/" + entryIdToDelete, {
        method: "DELETE",
    });

    if(response.status != 200) {
        showError("Failed to delete Guestbook entry with id=" + entryIdToDelete);
        return;
    }
}

function showError(msg, exception) {
    console.log(msg, exception);
    alert(msg);
}