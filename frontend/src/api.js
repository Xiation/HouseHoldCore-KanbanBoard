// read the API base URL from the environment variable
const API_BASE = import.meta.env.API_URL || 'http://localhost:3000/api';

export async function fetchBoard() {
    // send a GET request to API_BASE + '/board' and return the JSON response
    const response = await fetch(`${API_BASE}/board`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function claimChore(choreId, memberId) {
    // send a POST request to API_BASE + `/chores/${choreId}/claim` with { memberId } in the body
    // content-type: application/json header needed

    const response = await fetch(`${API_BASE}/chores/${choreId}/claim`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memberId })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function completeChore(choreId) {
    // send a POST request to API_BASE + `/chores/${choreId}/complete`
    // empty body
    const response = await fetch(`${API_BASE}/chores/${choreId}/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function getMembers() {
    // send a GET request to API_BASE + '/members' and return the JSON response
    // board response already includes members
    // keep this for completeness/future use
    const response = await fetch(`${API_BASE}/members`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

