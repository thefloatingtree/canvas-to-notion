fetch('https://byui.instructure.com/api/v1/users/self/courses?per_page=100&enrollment_state=active')
    .then(res => res.json())
    .then(courses => {
        const coursePromises = courses
            .map(({ id, name }) =>
                fetch(`https://byui.instructure.com/api/v1/users/self/courses/${id}/assignments?per_page=1000`)
                    .then(res => res.json())
                    .then(rawAssignments => {
                        const assignments = rawAssignments.map(({ due_at, name, html_url }) => { return { due_at, name, html_url } })
                        return { courseTitle: name, assignments }
                    }))
        Promise.all(coursePromises)
            .then(data => console.log(JSON.stringify(data)))
    })