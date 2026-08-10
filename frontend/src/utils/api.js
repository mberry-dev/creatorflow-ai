const BASE_URL = 'http://localhost:5000/api';

async function postRequest(endpoint, payload) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
}

export const generateTitles = (topic, platform, tone) => 
  postRequest('/generate/title', { topic, platform, tone });