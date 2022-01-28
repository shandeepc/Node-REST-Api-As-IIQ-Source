const logger = require('../middleware/logger');
const fs =  require('fs');
const fsPromises =  require('fs').promises;
const path =  require('path');
const Joi = require('joi');

let data = [];
data.employees = require('../model/employees.json');
data.groups = require('../model/groups.json');

const employeeSchema = Joi.object({
    id: Joi.number().required(),
    firstname: Joi.string().min(1).max(30).required(),
    lastname: Joi.string().min(1).max(30).required(),
    email: Joi.string().email().required(),
    groups:Joi.array().items(Joi.number()).min(1).optional()
});

async function updateData (dPath, content) {
    try {
        await fsPromises.writeFile(path.join(__dirname,'..','model',dPath), JSON.stringify(content, null, 4));
        if(dPath === 'employees.json')
            data.employees = require(`../model/${dPath}`);
        else
            data.groups = require(`../model/${dPath}`);
    } catch(error) {
        logger.log(`Caught Exception --> ${error}`, 'errorLog.txt');
    }
}

function checkGroups (groupArray) {
    if(groupArray){
        for(let element of groupArray) {
            if(!data.groups.find(g => g.id === element)) {
                return `${element} is not a valid group ID`;
            }
        }
    }
    return 'Okay';
}

const getAllEmployees = (request, response) => {
    //console.log(request);
    response.status(200).json(data.employees);
}

const createNewEmployee = (request, response) => {
    let newEmployee = request.body;
    logger.log(`Recieved body --> ${JSON.stringify(newEmployee)}`, 'reqLog.txt');
    newEmployee.id = data.employees.at(-1).id + 1;

    let validationResult = employeeSchema.validate(newEmployee);

    if(validationResult.error) {
        response.status(400).json({ "error": validationResult.error.details[0].message });
    } else {
        let isGroupValid = checkGroups(newEmployee.groups);
        if( isGroupValid != 'Okay') {
            response.status(400).json({ "error": `${isGroupValid}` });
        } else {
            logger.log(`Updated body --> ${JSON.stringify(newEmployee)}`, 'reqLog.txt');
            data.employees.push(newEmployee);
            if(newEmployee.groups) {
                for(let element of newEmployee.groups) {
                    if(data.groups.find(g => g.id === element).members) {
                        if(!data.groups.find(g => g.id === element).members.find(newEmployee.id)) {
                            data.groups.find(g => g.id === element).members.push(newEmployee.id);
                        }
                    } else {
                        data.groups.find(g => g.id === element).members = [ newEmployee.id ];
                    }
                }
            }
            updateData('employees.json',data.employees);
            updateData('groups.json',data.groups);
            response.status(201).json(newEmployee);
        }
    }
}

const updateEmployee = (request, response) => {
    let updtEmployee = request.body;
    logger.log(`Recieved body --> ${JSON.stringify(updtEmployee)}`, 'reqLog.txt');
    updtEmployee.id = parseInt(request.params.id);

    let validationResult = employeeSchema.validate(updtEmployee);

    if(validationResult.error) {
        response.status(400);
        response.json({ "error": validationResult.error.details[0].message });
    } else {
        let isGroupValid = checkGroups(updtEmployee.groups);
        if( isGroupValid != 'Okay') {
            response.status(400).json({ "error": `${isGroupValid}` });
        } else {
            if(data.employees.find(e => e.id === updtEmployee.id)) {
                data.employees.find(e => e.id === updtEmployee.id).firstname = updtEmployee.firstname;
                data.employees.find(e => e.id === updtEmployee.id).lastname = updtEmployee.lastname;
                let oldGroups = data.employees.find(e => e.id === updtEmployee.id).groups;
                data.employees.find(e => e.id === updtEmployee.id).groups = updtEmployee.groups;
                logger.log(`Updated body --> ${JSON.stringify(updtEmployee)}`, 'reqLog.txt');
                if(updtEmployee.groups) {
                    let groupsToRemove = [];
                    let groupsToGrant = updtEmployee.groups;
                    if(oldGroups) {
                        groupsToRemove = oldGroups.filter( ( g ) => !updtEmployee.groups.includes( g ) );
                        groupsToGrant = groupsToGrant.concat(oldGroups);
                        groupsToGrant = groupsToGrant.filter( ( g ) => !groupsToRemove.includes( g ) );
                    }
                    groupsToGrant = Array.from(new Set(groupsToGrant)); 
                    groupsToRemove = Array.from(new Set(groupsToRemove));

                    logger.log(`Groups to grant --> ${groupsToGrant}`, 'reqLog.txt');
                    logger.log(`Groups to remove --> ${groupsToRemove}`, 'reqLog.txt');
                    //return;
                    for(let element of groupsToGrant) {
                        if(data.groups.find(g => g.id === element).members){
                            if(!data.groups.find(g => g.id === element).members.includes(updtEmployee.id))
                                data.groups.find(g => g.id === element).members.push(updtEmployee.id);
                        } else {
                            data.groups.find(g => g.id === element).members = [ updtEmployee.id ];
                        }
                    }
                    for(let element of groupsToRemove) {
                        data.groups.find(g => g.id === element).members.splice(data.groups.find(g => g.id === element).members.indexOf(updtEmployee.id),1);
                        if(data.groups.find(g => g.id === element).members.length == 0)
                            delete data.groups.find(g => g.id === element)['members'];
                    }
                } else {
                    for(let element of data.groups) {
                        if(element.members && element.members.indexOf(updtEmployee.id) != -1) {
                            element.members.splice(element.members.indexOf(updtEmployee.id),1);
                            if(element.members.length == 0)
                                delete element['members'];
                        }
                    }
                }
                updateData('employees.json',data.employees);
                updateData('groups.json',data.groups);
                response.status(201).json(updtEmployee);
            } else {
                response.status(404).json({ "error": `Cannot find an existing employee with ID ${updtEmployee.id}` });
            }
        }
        
    }
}

const deleteEmployee = (request, response) => {
    if(data.employees.find(e => e.id === parseInt(request.params.id))) {
        logger.log(`Deleting user --> ${JSON.stringify(data.employees.find(e => e.id === parseInt(request.params.id)))}`, 'reqLog.txt');
        data.employees.pop(data.employees.find(e => e.id === parseInt(request.params.id)));
        for(let element of data.groups) {
            if(element.members)
                element.members.pop(parseInt(request.params.id));
        }
        updateData('employees.json',data.employees);
        updateData('groups.json',data.groups);
        response.status(200).json({ "message": `Deleted user with ID ${request.params.id}` });
    } else {
        response.status(404).json({ "error": `Cannot find an employee with ID ${request.params.id}` });
    }
}

const getEmployee = (request, response) => {
    let employee = data.employees.find(e => e.id === parseInt(request.params.id));
    logger.log(JSON.stringify(employee), 'reqLog.txt');
    if(!employee) {
        response.status(404).json({ "error": `Employee with Id ${request.params.id} Not Found` });
    } else {
        response.status(200).json(employee);
    }
}

module.exports = { getAllEmployees, createNewEmployee, updateEmployee, deleteEmployee, getEmployee };