const { Client } = require("@notionhq/client")

function makeAssignmentPage({ due_at, name, html_url, courseTitle }, databaseId) {
    const dateObj = new Date(due_at)
    const justTheDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    return {
        parent: { database_id: databaseId },
        icon: { type: 'emoji', emoji: '⚡' },
        properties: {
            'Due By': { date: { start: justTheDate, end: null } },
            'Class': { select: { name: courseTitle } },
            'Name': {
                title: [{
                    text: {
                        content: name,
                    },
                }]
            },
            'Do By': { date: { start: justTheDate, end: null } },
            'Canvas': { url: html_url }
        }
    }
}

async function makeAssignmentFromPage(page, notionClient) {
    try {
        await notionClient.pages.create(page)
    } catch (e) {
        console.error(e)
    }
}

class Requester {
    constructor(pages, notionClient) {
        this.pages = pages
        this.currentIndex = 0
        this.notionClient = notionClient
    }

    async next() {
        // base case, no more pages
        if (!this.pages[this.currentIndex]) return
        // do the request
        await makeAssignmentFromPage(this.pages[this.currentIndex], this.notionClient)
        // log progress, start next page
        console.log(`Created page ${this.currentIndex + 1} of ${this.pages.length}`)
        this.currentIndex++
        await this.next()
    }
}

async function makeAssignmentsInNotion(assignments, notionSecret) {

    // Initializing a client
    const notionClient = new Client({
        auth: notionSecret
    })

    // Get the databaseId
    const databaseId = (await notionClient.search({ filter: { value: "database", property: "object" } })).results[0].id

    // Make sure property schema exists in database
    await notionClient.databases.update({
        database_id: databaseId,
        properties: {
            'Due By': { type: 'date', date: {} },
            'Completed': { type: 'checkbox', checkbox: {} },
            'Severity': {
                type: 'select', select: {
                    options: [
                        { name: "Easy", color: "orange" },
                        { name: "Medium", color: "green" },
                        { name: "Hard", color: "gray" },
                        { name: "Extra Credit", color: "blue" },
                    ]
                }
            },
            'Place': { type: 'rich_text', rich_text: {} },
            'Class': { type: 'select', select: {} },
            'Do By': { type: 'date', date: {} },
            'Canvas': { type: "url", url: {} }
        }
    })

    // Make assignment pages and send them to notion
    const pages = assignments.map(assignment => makeAssignmentPage(assignment, databaseId))
    await new Requester(pages, notionClient).next()
}

module.exports = { makeAssignmentsInNotion }
