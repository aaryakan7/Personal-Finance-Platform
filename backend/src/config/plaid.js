const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

let client = null;

function getPlaidClient() {
  if (client) return client;

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw Object.assign(
      new Error("PLAID_CLIENT_ID / PLAID_SECRET are not set. Add them to backend/.env."),
      { status: 500 }
    );
  }

  const env = process.env.PLAID_ENV || "sandbox";

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });

  client = new PlaidApi(configuration);
  return client;
}

module.exports = { getPlaidClient };
