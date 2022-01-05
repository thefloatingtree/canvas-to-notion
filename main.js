const clipboard = require('clipboardy')
const fs = require('fs')
const { MultiSelect, Select, Confirm, Input } = require('enquirer')

const { makeAssignmentsInNotion } = require('./src/notion.js')

function badInput() {
    console.error("Clipboard text could not be parsed")
    process.exit()
}

function formatForCSV(assignments) {
    // make all assignment names unique
    assignments = assignments.map((assignment, index) => {
        return { ...assignment, name: (assignment.name + `@${index}`) }
    })

    // transform each assignment into csv row
    csvAssignmentRows = assignments.map(({ due_at: dueDate, name, html_url: url, courseTitle }) => {
        return `=HYPERLINK("${url}","${name}");${courseTitle};;${dueDate};FALSE\n`
    })

    // combine all assignment rows into single csv string
    return csvAssignmentRows.join('')
}

function outputClipboard(assignments) {
    clipboard.writeSync(formatForCSV(assignments))
    console.log("Wrote output to clipboard")
}

function outputCSV(assignments) {
    fs.writeFileSync('out.csv', "sep=;\n" + formatForCSV(assignments))
    console.log("Wrote output to CSV file")
}

async function outputNotion(assignments) {

    console.log(`To export to notion: 
    - Create an integration at https://developers.notion.com/ to obtain a token
    - Create a new page with a calendar view in notion
    - Invite your new integration to your new page with the share button
    `)

    const answer = await new Confirm({
        message: 'I have created a new page and have shared my integration with it'
    }).run()

    const notionSecret = await new Input({
        message: 'Integration Secret',
        initial: 'secret_<token>'
    }).run()

    if (!answer) {
        console.log('\nExiting\n')
        return
    }

    console.log('')

    await makeAssignmentsInNotion(assignments, notionSecret)
    console.log("\nDone\n")
}

async function main() {

    console.log('\nCanvas to Notion Tool')
    console.log(`
To get started:
    - Navigate to your Canvas Dashboard in a web browser and press ctrl+shift+j. This will open the JavaScript console. 
    - A small piece of code has been copied to your clipboard, paste and run it in the console. 
    - Copy the resulting JSON string to your clipboard.
    `)
    

    clipboard.writeSync(`
        fetch('https://byui.instructure.com/api/v1/users/self/courses?per_page=100&enrollment_state=active')
        .then(res => res.json())
        .then(courses => {
            const coursePromises = courses
                .map(({ id, name }) =>
                    fetch(\`https://byui.instructure.com/api/v1/users/self/courses/\${id}/assignments?per_page=1000\`)
                        .then(res => res.json())
                        .then(rawAssignments => {
                            const assignments = rawAssignments.map(({ due_at, name, html_url }) => { return { due_at, name, html_url } })
                            return { courseTitle: name, assignments }
                        }))
            Promise.all(coursePromises)
                .then(data => console.log(JSON.stringify(data)))
        })
    `)

    const answer = await new Confirm({
        message: 'I have a JSON string in my clipboard and am ready to continue'
    }).run()

    if (!answer) {
        console.log('\nExiting\n')
        return
    }

    console.log("\nSuccessfully read courses from clipboard\n")

    let rawCourses = []
    try {
        rawCourses = clipboard.readSync()
        if (!rawCourses) badInput()
    } catch {
        badInput()
    }
 
    let courses = []
    try {
        courses = JSON.parse(rawCourses)
        if (!courses[0].courseTitle) badInput()
    } catch {
        badInput()
    }

    // Filter out unwanted courses

    const courseChoices = courses.map((course, index) => {
        return {
            name: index + ". " + course.courseTitle,
            value: index
        }
    })

    const selectedCourses = await new MultiSelect({
        message: 'Pick courses to include in export',
        limit: 100,
        choices: courseChoices,
        result(names) {
            return this.map(names)
        }
    }).run()

    courses = Object.values(selectedCourses).map(courseIndex => courses[courseIndex])

    // add courseTitle key to each assignment
    // flatten assignments into a single list

    let assignments = []
    courses.forEach(({ courseTitle, assignments: courseAssignments }) => {
        assignments.push(...courseAssignments.map(assignment => {
            assignment.courseTitle = courseTitle
            return assignment
        }))
    })

    // sort them by due date

    assignments.sort((a, b) => {
        return new Date(a.due_at) - new Date(b.due_at)
    })

    // remove any assignments with no due date

    assignments = assignments.filter(assignment => assignment.due_at)

    // Configure output

    const selectedOutput = await new Select({
        name: 'output',
        message: 'Select output method',
        choices: ['notion', 'csv file', 'csv file (clipboard)']
    }).run()

    console.log('')

    const outputs = {
        "notion": outputNotion,
        "csv file": outputCSV,
        "csv file (clipboard)": outputClipboard,
    }
    outputs[selectedOutput](assignments)
}

main()