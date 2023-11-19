const express = require("express");
const { MongoClient } = require("mongodb");
const retry = require("async-retry");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

app.use(bodyParser.json({ limit: "10mb" }));

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        process.exit(1); // Exit the process if there's a database connection error
    }
}
connectToDatabase();

async function insertLogs(logs, logsCollection) {
    try {
        const result = await logsCollection.insertMany(logs);
        console.log(`${result.insertedCount} logs stored in MongoDB`);
        return true;
    } catch (error) {
        console.error("Error storing log data in MongoDB: ", error);
        return false;
    }
}

let logBatch = [];
app.post("/logs", async (req, res) => {
    const logData = req.body;
    logBatch.push(logData);
    
    if (logBatch.length >= 100) {
        const database = client.db("logs");
        const logsCollection = database.collection("logs");

        const insertionSuccessful = await retry(
            async () => {
                return await insertLogs(logBatch, logsCollection);
            },
            {
                retries: 3,
                minTimeout: 1000,
                maxTimeout: 5000,
                factor: 2,
            }
        );

        if (insertionSuccessful) {
            logBatch = [];
            res.status(200).send("Logs received and stored in MongoDB");
        } else {
            res.status(500).send("Error storing log data.");
        }
    } else {
        res.status(200).send("Logs received and stored in batches for processing");
    }
});

app.get("/", (req, res) => {
    res.send("Server is running");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on("SIGINT", () => {
    client.close().then(() => {
        console.log("MongoDB connection closed");
        process.exit(0);
    });
});
