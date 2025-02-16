// File: src/utils/error.js

/**
 * Extracts a meaningful error message from an error object.
 *
 * @param {Object} error - The error object from an Axios request.
 * @returns {string} The extracted error message.
 */
export const extractErrorMessage = (error) => {
    // If the error response exists and contains data, try to extract its message.
    if (error.response && error.response.data) {
      if (error.response.data.message) {
        return error.response.data.message;
      }
      // If there's no specific message, stringify the data.
      return JSON.stringify(error.response.data);
    }
    // Fallback to error.message or a generic message.
    return error.message || "An error occurred";
  };
  