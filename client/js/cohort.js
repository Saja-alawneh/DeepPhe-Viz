// Global settings


const transitionDuration = 800; // time in ms

// Keep the pateints data in memory
let allPatients = [];

// Patients array based on the current stage chart selection
let patientsByStage = [];
let patientByLabel =[];

// Patients array based on the current first encounter age chart selection
let patientsByFirstEncounterAge = [];

const allStagesLabel = "All stages";

// Array that contains the current min age and max age based on age chart selection
let currentFirstEncounterAgeRange = [];

// All stages in a sorted order
const orderedCancerStages = [
    'Stage 0', 
    // Stage I
    'Stage I',
    'Stage IA',
    'Stage IB',
    'Stage IC',
    // Stage II
    'Stage II',
    'Stage IIA',
    'Stage IIB',
    'Stage IIC',
    // Stage III
    'Stage III',
    'Stage IIIA',
    'Stage IIIB',
    'Stage IIIC',
    // Stage IV
    'Stage IV',
    'Stage IVA',
    'Stage IVB',
    'Stage IVC',
    // Stage Unknown
    'Stage Unknown'
];

// All top-level stages
const topLevelStages = [
    'Stage 0', 
    'Stage I', 
    'Stage II', 
    'Stage III', 
    'Stage IV'
];

// Min and max age across all the patients
let minAge;
let maxAge;

// Return the intersection of two patient arrays
function getTargetPatients(patientsByStage, patientsByFirstEncounterAge) {
	// Create a list of IDs
	let patientsByStageIds = patientsByStage.map(function(obj) {
        return obj.patientId;
	});

    let patientsByFirstEncounterAgeIds = patientsByFirstEncounterAge.map(function(obj) {
        return obj.patientId;
	});

    // Find common patient Ids
    let targetPatientIds = patientsByStageIds.filter(function(id) {
        return patientsByFirstEncounterAgeIds.indexOf(id) > -1;
    });

    // Find the patient objects based on common patient IDs
    // No need to sort/order the targetPatients since it's already sorted in dataProcessor
    let targetPatients = patientsByStage.filter(function(obj) {
    	return targetPatientIds.indexOf(obj.patientId) > -1;
    });

	return targetPatients;
}

// Entry point
function showCohort() {
    $.ajax({
	    url: baseUri + '/cohortData',
	    method: 'GET', 
	    async : true,
	    dataType : 'json'
	})
	.done(function(response) {
        // Keep the data in memory for later use
        allPatients = response.patients;

        // Set as all the target patients for the first load
        patientsByStage = response.patients;
        patientsByFirstEncounterAge = response.patients;

        // Draw the stages chart
        // We can click the stage bar to show charts of this stage 
        // and unclick to show all again
        showPatientCountPerStageChart("stage_patient_count", response.stagesInfo);

        // Patient first encounter age chart
        showPatientFirstEncounterAgePerStageChart("stage_patient_age", response.stagesInfo);

        // By default show charts of all pateints of all ages (first encounter age) from all stages
        showDerivedCharts(allPatients, allStagesLabel, currentFirstEncounterAgeRange);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get cancer stages");
	});
}

function showPatientCountPerStageChart(svgContainerId, data) {
	let patientsCounts = {};

	// Calculate and add the box plot data to each stageInfo object
	data.forEach(function(stageInfo) {
	    // Add to patientsCounts object for later use (modify the Y label)
	    if (typeof patientsCounts[stageInfo.stage] === "undefined") {
            patientsCounts[stageInfo.stage] = stageInfo.patientsCount;
	    }
	});

	// set the dimensions and margins of the graph
	const svgWidth = 400;
	const svgHeight = 300;
	// svgPadding.top is used to position the chart title
	// svgPadding.left is the space for Y axis labels
	const svgPadding = {top: 1, right: 10, bottom: 15, left: 90};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	// Gap between svg top and chart top, nothing to do with svgPadding.top
	const chartTopMargin = 35;

    // All stages found in data
    let allStages = data.map(function(d) { 
		return d.stage; 
	});

	// By default only show the top level stages if has data
	// otherwise show sub stages directly
	// Here the data is already sorted by stage name in dataProcessor
	let defaultStagesData = data.filter(function(d) { 
		if (orderedCancerStages.indexOf(d.stage) !== -1) {
            return d.stage;
		}
	});

    let xCount = d3.scaleLinear()
	    .domain([0, d3.max(data, function(d) { 
			return d.patientsCount; 
		})])
		.range([0, chartWidth]);

	let y = d3.scaleBand()
		.domain(defaultStagesData.map(function(d) { 
			return d.stage; 
		}))
		.range([0, chartHeight - chartTopMargin]) // top to bottom: stages by patients count in ascending order 
		.padding(0.32); // blank space between bands

	let svg = d3.select("#" + svgContainerId).append("svg")
		.attr("width", svgWidth)
		.attr("height", svgHeight);

	let stagesChartGrp = svg.append("g")
		.attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

    // Chart title
    svg.append("text")
        .attr("class", "stages_chart_title")
        .attr("transform", function(d) { 
        	// Works together with "dominant-baseline:text-before-edge;"" in CSS
        	// to position the text based on upper left corner
			return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
		})
        .text("Patient Count Per Stage");

    // Render the boxplots before rendering the Y axis
    // so the Y axis vertical line covers the bar border
    renderDistribution(defaultStagesData);
    // renderYAxis() is based ont the y.domain(), so no argument
    renderYAxis();

    // Show only integer numbers for the ticks when the max count is less than 10
    // otherwise use the default ticks
    let xCountAxis;
    if (xCount.domain()[1] >= 10) {
        xCountAxis = d3.axisBottom(xCount);
    } else {
    	let xCountTickValues = [];
	    for (let i = 0; i <= xCount.domain()[1]; i++) {
	        xCountTickValues.push(i);
	    }
    	xCountAxis = d3.axisBottom(xCount).tickValues(xCountTickValues).tickFormat(d3.format("d"));
    }

    // Add patients count top X axis
	stagesChartGrp.append("g")
		.attr("transform", "translate(0, " + (chartHeight - chartTopMargin) + ")")
		.attr("class", "count_axis")
		
		.call(xCountAxis)
		// Append axis label
		.append("text")
		.attr("class", "count_axis_label")
		.attr("x", chartWidth)
		.attr("y", -3)
		.text("Number of patients");
  

    // Render all stage bars and boxplots
	function renderDistribution(data) {
	    // Bar chart of patients counts
		stagesChartGrp.append("g").selectAll(".stage_bar")
			.data(data)
			.enter().append("rect")
			.attr("class", function(d) {
				// Distiguish the top stages, sub stages, and unknown stage using different bg and border colors
				if (d.stage !== "Stage Unknown") {
                    return "stage_bar " + ((topLevelStages.indexOf(d.stage) !== -1) ? "top_stage_bar " : "sub_stage_bar ") + d.stage.replace(" ", "_") ;
				} else {
                    return "stage_bar unknown_stage_bar " + d.stage.replace(" ", "_") ;
				}
			})
			.attr("transform", function(d) { 
				return "translate(0, " + y(d.stage) + ")"; 
			})
			.attr("height", y.bandwidth())
			.on("click", function(d) {
	            let clickedBar = d3.select(this);
	            let css = "clicked_bar";

	            // Toggle
	            if (!clickedBar.classed(css)) {
	            	// Remove previouly added css class
		            svg.selectAll(".stage_bar").classed(css, false);
	                // Highlight the clicked box and show corresponding patients
	            	clickedBar.classed(css, true);

	            	// Update patientsByStage
	            	patientsByStage = d.patients;

                    let targetPatients = getTargetPatients(patientsByStage, patientsByFirstEncounterAge);

	            	showDerivedCharts(targetPatients, d.stage, currentFirstEncounterAgeRange);
	            } else {
	            	// When clicked again, remove highlight and show all patients
	            	clickedBar.classed(css, false);

	            	// Update patientsByStage
	            	// allPatients is the patient data saved in memory
	            	patientsByStage = allPatients;
	            	
	            	let targetPatients = getTargetPatients(patientsByStage, patientsByFirstEncounterAge);

	            	showDerivedCharts(targetPatients, allStagesLabel, currentFirstEncounterAgeRange);
	            }
			})
			.transition()
	        .duration(transitionDuration)
			.attr("width", function(d) { 
				return xCount(d.patientsCount);
			});
	}

    // Render Y axis
	function renderYAxis() {
		stagesChartGrp.append("g")
		    .attr("transform", "translate(0, 0)")
		    .attr("id", "patient_count_chart_y_axis")
			.call(d3.axisLeft(y))
			// Add custom id to each tick group
			.selectAll(".tick")
			.attr("class", function(d) {
				// Distiguish the top stage and sub stage labels using different colors
				return "tick " + ((topLevelStages.indexOf(d) !== -1) ? "top_stage" : "sub_stage");
			})
			// Now modify the label text to add patients count
			.selectAll("text")
			.text(function(d) {
				return d + " (" + patientsCounts[d] + ")";
			});

        // Only add click event to top level stages
		svg.selectAll(".top_stage > text").on("click", function(d) {
            let displayStages = y.domain();

            // Click top-level stage label to show sub level stages
            let subLevels = [d + "A",  d + "B", d  + "C"];
            let addedSubStages = [];
            let removedSubStages = [];

			subLevels.forEach(function(stage) {
			    // sub stage must belong to the allStages
			    if (allStages.indexOf(stage) !== -1) {
                    // Add this sub stage to the stages to display when expanding the top stage
                    // Remove the sub stage from the display stages when collapsing the top stage
                    if (displayStages.indexOf(stage) === -1) {
	                    displayStages.push(stage);

	                    // Also add to updatedSubStages so we know the changes
	                    // No need to sort this array since it's based on the A, B, C
	                    addedSubStages.push(stage);
				    } else {
	                    let index = displayStages.indexOf(stage);
	                    displayStages.splice(index, 1);

                        // Also add to removedSubStages
	                    removedSubStages.push(stage);
				    }
                }
			});

            
            // Need to sort the displayStages so the sub-stages appear under each top-stage
            let sortedDisplayStages = sortByProvidedOrder(displayStages, orderedCancerStages);

            // Also update the y.domain()
		    y.domain(sortedDisplayStages);

            // Now for UI updates
            svg.selectAll("#patient_count_chart_y_axis").remove();

            function reposition() {
	            // Repoition the existing stage bars and resize height
	            svg.selectAll(".stage_bar")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + y(d.stage) + ")";
	                })
					.attr("height", y.bandwidth());

	            // Reposition the single pateint groups
	            svg.selectAll(".single_patient_group")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
	                });
            }

            // Add sub stage bars and boxplots
            if (addedSubStages.length > 0) {
                let updatedData = data.filter(function(d) { 
					if (addedSubStages.indexOf(d.stage) !== -1) {
			            return d.stage;
					}
				});

                // Reposition the exisiting stages BEFORE adding new sub stages
	            reposition();

                // The last thing is to add new sub stages
				renderDistribution(updatedData);
            }

            // Or remove sub stage bars and boxplots
			if (removedSubStages.length > 0) {
				removedSubStages.forEach(function(stage) {
                    // Can't get the transition work here with reposition
                    svg.selectAll("." + stage.replace(" ", "_"))
						.remove();
				});

				// Reposition the rest of stages AFTER removing target sub stages
				reposition();
			}	

            // Re-render Y axis after the bars/boxplots so the vertical line covers the bar border
		    renderYAxis();
		});
    }
}

function showPatientFirstEncounterAgePerStageChart(svgContainerId, data) {
	let patientsCounts = {};

	// In order to get the minAge and maxAge
	let minAges = [];
	let maxAges = [];

	// Calculate and add the box plot data to each stageInfo object
	data.forEach(function(stageInfo) {
		// Must sort the ages by asending order
        // By default, the sort method sorts elements alphabetically. 
        // To sort numerically just add a new method which handles numeric sorts
        stageInfo.ages.sort(function(a, b) {
            return a - b;
        });

		// Initialise stats object
	    let ageStats = {
	        minVal: Infinity,
	        lowerWhisker: Infinity,
	        q1Val: Infinity,
	        medianVal: 0,
	        q3Val: -Infinity,
	        iqr: 0, // Interquartile range or IQR
	        upperWhisker: -Infinity,
	        maxVal: -Infinity
	    };

	    // calculate statistics
	    // stageInfo.ages is already sorted array
	    ageStats.minVal = stageInfo.ages[0];
	    ageStats.q1Val = Math.round(d3.quantile(stageInfo.ages, .25));
	    ageStats.medianVal = Math.round(d3.quantile(stageInfo.ages, .5));
	    ageStats.q3Val = Math.round(d3.quantile(stageInfo.ages, .75));
	    ageStats.iqr = ageStats.q3Val - ageStats.q1Val;
	    ageStats.maxVal = stageInfo.ages[stageInfo.ages.length - 1];

        // Add new property
	    stageInfo.ageStats = ageStats;

        // Add to patientsCounts object for later use (modify the Y label)
	    if (typeof patientsCounts[stageInfo.stage] === "undefined") {
            patientsCounts[stageInfo.stage] = stageInfo.patientsCount;
	    }

	    // Also kepp record of the min age and max age for rendering the x axis as well as 
	    // age range in the patients table
	    minAges.push(ageStats.minVal);
	    maxAges.push(ageStats.maxVal);
	});

    // Make the min and max age range global
    minAge = Math.min.apply(null, minAges);
    maxAge = Math.max.apply(null, maxAges);

	// set the dimensions and margins of the graph
	const svgWidth = 400;
	const svgHeight = 300;

	// svgPadding.top is used to position the chart title
	// svgPadding.left is the space for Y axis labels
	const svgPadding = {top: 10, right: 3, bottom: 10, left: 90};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	// Gap between svg top and chart top, nothing to do with svgPadding.top
	const chartTopMargin = 35;

    // Box plot
    const boxHeight = 15;
    const textBottomPadding = 3;

    // All stages found in data
    let allStages = data.map(function(d) { 
		return d.stage; 
	});

	// By default only show the top level stages if has data
	// otherwise show sub stages directly
	let defaultStagesData = data.filter(function(d) { 
		if (orderedCancerStages.indexOf(d.stage) !== -1) {
            return d.stage;
		}
	});

	// set the ranges

	// age offset, so the min/max age doesn't overlap the y axis or right boundary
	let ageOffset = 5;

	let x = d3.scaleLinear()
	    .domain([minAge - ageOffset, maxAge + ageOffset])
	    .range([0, chartWidth]);

	let y = d3.scaleBand()
		.domain(defaultStagesData.map(function(d) { 
			return d.stage; 
		}))
		.range([0, chartHeight - chartTopMargin]) // top to bottom: stages by patients count in ascending order 
		.padding(0.2); // blank space between bands

	let svg = d3.select("#" + svgContainerId).append("svg")
		.attr("width", svgWidth)
		.attr("height", svgHeight);

	let stagesChartGrp = svg.append("g")
		.attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

    let distributionGrp = stagesChartGrp.append("g");

    let ageSelectionGrp = stagesChartGrp.append("g");

    // Chart title
    svg.append("text")
        .attr("class", "stages_chart_title")
        .attr("transform", function(d) { 
        	// Works together with "dominant-baseline:text-before-edge;"" in CSS
        	// to position the text based on upper left corner
			return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
		})
        .text("Patient Age of First Encounter Per Stage");

    // Render the bars before rendering the Y axis
    // so the Y axis vertical line covers the bar border
    renderDistribution(defaultStagesData);
    // renderYAxis() is based ont the y.domain(), so no argument
    renderYAxis();

    // Add the ages bottom X Axis
	stagesChartGrp.append("g")
		.attr("transform", "translate(0, " + (chartHeight - chartTopMargin) + ")")
		.attr("class", "age_axis")
		.call(d3.axisBottom(x))
		// Append axis label
		.append("text")
		.attr("class", "age_axis_label")
		.attr("x", chartWidth)
		.attr("y", -3)
		.text("Age of first encounter");


    // Age range selection
    let brush = d3.brushX()
        // Restrict the brush move between minAge and maxAge
	    .extent([[x(minAge), 0], [x(maxAge), (chartHeight - chartTopMargin)]])
	    .on("brush", duringBrush)
	    // Only activate listener at the end of a brush gesture, such as on mouseup.
	    // Update the resulting charts on brush end
	    .on("end", endBrush);

    let ageSelectionBrush = ageSelectionGrp.append("g")
		.attr("transform", "translate(0, 0)")
		.attr("class", "age_selection_brush");
		
    // Add custom brush handles
	let customBrushHandlesData = [{type: "w"}, {type: "e"}];

    // Function expression to create custom brush handle path
	let createCustomBrushHandle = function(d) {
	    let e = +(d.type === "e"),
	        x = e ? 1 : -1,
	        y = chartHeight / 2;

	    return "M" + (.5 * x) + "," + y + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) + "V" + (2 * y - 6) + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y) + "Z" + "M" + (2.5 * x) + "," + (y + 8) + "V" + (2 * y - 8) + "M" + (4.5 * x) + "," + (y + 8) + "V" + (2 * y - 8);
	};

	let customBrushHandle = ageSelectionBrush.selectAll(".handle--custom")
	    .data(customBrushHandlesData)
	    .enter().append("path")
	    .attr("class", "handle--custom")
	    .attr("cursor", "ew-resize")
		.attr("d", createCustomBrushHandle)
		.attr("transform", function(d, i) { 
        	// Position the custom handles based on the default selection range
        	let selection = [minAge, maxAge].map(x);
        	return "translate(" + [selection[i], -chartHeight/8] + ")"; 
        });

    // Function expression of updating custom handles positions
	let moveCustomBrushHandles = function(selection) {
		customBrushHandle
	        .attr("transform", function(d, i) { 
	        	return "translate(" + [selection[i], -chartHeight/3] + ")"; 
	        });
	};

    // Attach brush and move to default position
    // must call this before removing pointer events
	ageSelectionBrush.call(brush)
		// By default, move the brush to start at minAge and end at maxAge
		.call(brush.move, [minAge, maxAge].map(x))

	// Update the default currentFirstEncounterAgeRange
	currentFirstEncounterAgeRange = [minAge, maxAge];

    // Remove pointer events on brushe overlay, this prevents new brush from being made
	// when users click outside the current brush area
	// So basically, we force the users to only either move the current brush selection 
	// or use the custom handles to resieze the brush selection.
	ageSelectionBrush.selectAll('.overlay').style('pointer-events', 'none');

    // Lower age text, default to minAge
    ageSelectionGrp.append("text")
        .attr("class", "age_range")
        .attr("id", "lower_age")
        .attr("x", x(minAge))
        .attr("y", 0)
        .text(minAge);

    // Upper age text, default to maxAge
    ageSelectionGrp.append("text")
        .attr("class", "age_range")
        .attr("id", "upper_age")
        .attr("x", x(maxAge))
        .attr("y", 0)
        .text(maxAge);

    // Set the default of currentFirstEncounterAgeRange
    currentFirstEncounterAgeRange = [minAge, maxAge];

    // Update/move the range limits as the brush moves
    // Also update the position of custom brush handles
    function duringBrush() {
		let selection = d3.event.selection;

		let extent = selection.map(x.invert, x);
		
        let lowerAge = Math.round(extent[0]);
        let upperAge = Math.round(extent[1]);

        // Update lower and upper ages
        // Rounding to integer only
		d3.select("#lower_age")
		    .attr("x", x(lowerAge))
	        .text(lowerAge);

	    d3.select("#upper_age")
		    .attr("x", x(upperAge))
	        .text(upperAge);

	    // Update the position of custom brush handles
    	moveCustomBrushHandles(selection);
	}

    // Filter the patients based on age selection 
    // Then update derived resulting charts
	function endBrush() {
		let extent = d3.event.selection.map(x.invert, x);
		
        let lowerAge = Math.round(extent[0]);
        let upperAge = Math.round(extent[1]);

        // Update patientsByFirstEncounterAge by filtering allPatients
	    patientsByFirstEncounterAge = allPatients.filter(function(obj) {
            return ((obj.firstEncounterAge >= lowerAge) && (obj.firstEncounterAge <= upperAge));
	    });

        // Update the final target patients array and resulting charts
        let targetPatients = getTargetPatients(patientsByStage, patientsByFirstEncounterAge);

        // Update currentFirstEncounterAgeRange
	    currentFirstEncounterAgeRange = [lowerAge, upperAge];

	    showDerivedCharts(targetPatients, allStagesLabel, currentFirstEncounterAgeRange);
	}


    // Render all stage bars and boxplots
	function renderDistribution(data) {
	    // Only show the patient age when the stage has only one patient
	    let singlePatientGrp = distributionGrp.append("g").selectAll(".single_patient_group")
			.data(data.filter(function(d) {
				return d.patientsCount === 1;
			}))
			.enter().append("g")
			.attr("class", function(d) {
				return "single_patient_group " + d.stage.replace(" ", "_");
			})
			.attr("transform", function(d) {
				return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
			});

		// Verical line of single age
		singlePatientGrp.append("line")
			.attr("class", "single_patient_age_line")
			.attr("x1", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y2", boxHeight);

		// Text of single age
		singlePatientGrp.append("text")
			.attr("class", "single_patient_text")
			.attr("x", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.minVal;
			});

		// Show the box plot for stage that has more than one patient
		let boxplotGrp = distributionGrp.append("g").selectAll(".boxplot")
			.data(data.filter(function(d) {
				return d.patientsCount > 1;
			}))
			.enter().append("g")
			.attr("class", function(d) {
				return "boxplot " + d.stage.replace(" ", "_");
			})
			.attr("transform", function(d) {
				return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
			});
			
	    // Verical line of min age
		boxplotGrp.append("line")
			.attr("class", "boxplot_min")
			.attr("x1", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y2", function(d) {
				return boxHeight;
			});

		// Text of min age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y", function(d) {
				return -textBottomPadding;
			})
			.text(function(d) {
	            return d.ageStats.minVal;
			});

		// Vertical line of max age
		boxplotGrp.append("line")  
			.attr("class", "boxplot_max")
			.attr("x1", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y2", boxHeight);

	    // Text of max age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.maxVal;
			});

		// Horizontal whisker lines
		boxplotGrp.append("line")
			.attr("class", "boxplot_whisker")
			.attr("x1",  function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", boxHeight/2)
			.attr("x2",  function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y2", boxHeight/2);

		// Rect for iqr
		boxplotGrp.append("rect")    
			.attr("class", "boxplot_box")
			.attr("x", function(d) {
	            return x(d.ageStats.q1Val);
			})
			.attr("y", 0)
			.attr("height", boxHeight)
			// Add transition on box rect rendering
			.transition()
	        .duration(transitionDuration)
	        .attr("width", function(d) {
	            return x(d.ageStats.q3Val) - x(d.ageStats.q1Val);
			});
	    
	    // Text of q1 age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.q1Val);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.q1Val;
			});

		// Text of q3 age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.q3Val);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.q3Val;
			});

	    // Must after the box so the bar doesn't gets covered by the box
		// Vertical line of median age
		boxplotGrp.append("line")
			.attr("class", "boxplot_median")
			.attr("x1", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y2", boxHeight);

		// Text of median age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y", -textBottomPadding)
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.ageStats.medianVal;
			});
	}

    // Render Y axis
	function renderYAxis() {
		stagesChartGrp.append("g")
		    .attr("transform", "translate(0, 0)")
		    .attr("id", "patient_age_chart_y_axis")
			.call(d3.axisLeft(y))
			// Add custom id to each tick group
			.selectAll(".tick")
			.attr("class", function(d) {
				// Distiguish the top stage and sub stage labels using different colors
				return "tick " + ((topLevelStages.indexOf(d) !== -1) ? "top_stage" : "sub_stage");
			})
			// Now modify the label text to add patients count
			.selectAll("text")
			.text(function(d) {
				return d + " (" + patientsCounts[d] + ")";
			});

        // Only add click event to top level stages
		svg.selectAll(".top_stage").on("click", function(d) {
            let displayStages = y.domain();

            // Click top-level stage label to show sub level stages
            let subLevels = [d + "A",  d + "B", d  + "C"];
            let addedSubStages = [];
            let removedSubStages = [];

			subLevels.forEach(function(stage) {
			    // sub stage must belong to the allStages
			    if (allStages.indexOf(stage) !== -1) {
                    // Add this sub stage to the stages to display when expanding the top stage
                    // Remove the sub stage from the display stages when collapsing the top stage
                    if (displayStages.indexOf(stage) === -1) {
	                    displayStages.push(stage);

	                    // Also add to updatedSubStages so we know the changes
	                    // No need to sort this array since it's based on the A, B, C
	                    addedSubStages.push(stage);
				    } else {
	                    let index = displayStages.indexOf(stage);
	                    displayStages.splice(index, 1);

                        // Also add to removedSubStages
	                    removedSubStages.push(stage);
				    }
                }
			});

            // Need to sort the displayStages so the sub-stages appear under each top-stage
            let sortedDisplayStages = sortByProvidedOrder(displayStages, orderedCancerStages);

            // Also update the y.domain()
		    y.domain(sortedDisplayStages);

            // Now for UI updates
            svg.selectAll("#patient_age_chart_y_axis").remove();

            function reposition() {
	            // Reposition the single pateint groups
	            svg.selectAll(".single_patient_group")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
	                });

	            // Reposition the boxplots
	            svg.selectAll(".boxplot")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
	                });
            }

            // Add sub stage bars and boxplots
            if (addedSubStages.length > 0) {
                let updatedData = data.filter(function(d) { 
					if (addedSubStages.indexOf(d.stage) !== -1) {
			            return d.stage;
					}
				});

                // Reposition the exisiting stages BEFORE adding new sub stages
	            reposition();

                // The last thing is to add new sub stages
				renderDistribution(updatedData);
            }

            // Or remove sub stage bars and boxplots
			if (removedSubStages.length > 0) {
				removedSubStages.forEach(function(stage) {
                    // Can't get the transition work here with reposition
                    svg.selectAll("." + stage.replace(" ", "_"))
						.remove();
						
				});

				// Reposition the rest of stages AFTER removing target sub stages
				reposition();
			}	

            // Re-render Y axis after the bars/boxplots so the vertical line covers the bar border
		    renderYAxis();
		});
    }
}


// No rest call since each stage data contains the patients list info
function showDerivedCharts(patientsArr, stage, firstEncounterAgeRange) {
    if (patientsArr.length > 0) {
        let patientIds = [];
	    patientsArr.forEach(function(patient) {
	    	patientIds.push(patient.patientId);
	    });

        showResultsTitle("results_title", patientsArr, stage, firstEncounterAgeRange);

        // Resulting target patients list
	    showPatientsList("patients", patientsArr, stage, firstEncounterAgeRange);

	    // Make another ajax call to get diagnosis for the list of patients
	    getDiagnosis(patientIds);
// Make another ajax call to get biomarkers info for the list of patients
		
		getBiomarkers(patientIds);

	    //Make another ajax call to get Labels info for the list of patients
	    getLabelSummary(patientIds);
    } else {
        console.log("Empty target patients list");

        // We'll need to remove the previous resulting charts
        removeChart("patients");
        removeChart("diagnosis");
		removeChart("biomarkers");
		removeChart("HeatMap")
		removeChart("Sankey")
    }
}

// Remove a chart of the given containerId
function removeChart(containerId) {
    d3.select("#" + containerId).selectAll("*").remove();
}

function showResultsTitle(containerId, data, stage, firstEncounterAgeRange) {
    removeChart(containerId);

    let html = 'Target Patients (' + data.length + ' patients from ' + stage + ', first encounter age between ' + firstEncounterAgeRange[0] + ' and ' + firstEncounterAgeRange[1] + ')';

    $("#" + containerId).html(html);
}

// All patients is a separate call
// patients of each stage is alrady loaded data
function showPatientsList(containerId, data, stage, firstEncounterAgeRange) {
    removeChart(containerId);

    let html = '<ul class="patient_list">';

    data.forEach(function(patient) {
    	html += '<li><a id="' + patient.patientId + '" class="target_patient" href="' + baseUri + '/patient/' + patient.patientId + '" target="_blank">' + patient.patientId.substring(8) + '</a> (' + patient.firstEncounterAge + ')</li>';
    });

    html += '</ul>';
    
    $("#" + containerId).html(html);
}

// Same as the one in dataProcessor
function sortByProvidedOrder(array, orderArr) {
    let orderMap = new Map();

    orderArr.forEach(function(item) { 
        // Remember the index of each item in order array
        orderMap.set(item, orderArr.indexOf(item));
    });

    // Sort the original array by the item's index in the orderArr
    // It's very possible that items are in array may not be in orderArr
    // so we assign index starting from orderArr.length for those items
    let i = orderArr.length;
    let sortedArray = array.sort(function(a, b){ 
        if (!orderMap.has(a)) {
            orderMap.set(a, i++);
        }

        if (!orderMap.has(b)) {
            orderMap.set(b, i++);
        }

        return (orderMap.get(a) - orderMap.get(b));
    });

    return sortedArray;
}


function showDiagnosisChart(svgContainerId, data) {
   removeChart(svgContainerId);

    const diagnosisDotRadius = 4;
    const highlightedDotRadius = 5;
    const overviewDotRadius = 1.5;
    const svgPadding = {top: 5, right: 20, bottom: 5, left: 170};
    const gapBetweenYAxisAndXAxis = 10;
    const chartTopMargin = 20;
    const xAxisHeight = 20;
    // 15 is the line height of each Y axis label
    const yAxisHeight = data.diagnosisGroups.length * 15;
    const overviewHeight = data.diagnosisGroups.length * overviewDotRadius * 3;
    const svgWidth = 480;
    const svgHeight = xAxisHeight + yAxisHeight + chartTopMargin + overviewHeight + gapBetweenYAxisAndXAxis * 2;
    const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
    const overviewWidth = chartWidth - gapBetweenYAxisAndXAxis;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom - overviewHeight - gapBetweenYAxisAndXAxis;

	let svg = d3.select("#" + svgContainerId).append("svg")
	    .attr("class", "diagnosis_chart") // Used for CSS styling
		.attr("width", svgWidth)
		.attr("height", svgHeight);

	let diagnosisChartGrp = svg.append("g")
	    .attr("class", "diagnosis_chart_group")
	    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");
    
    const dotColor = "rgb(107, 174, 214)";
    const highlightedDotColor = "rgb(230, 85, 13)";

    let xDomain = [];
    
    let diagnosisDots = [];

    data.data.forEach(function(d) {
    	xDomain.push(d.patient);

    	d.diagnosisGroups.forEach(function(diagGrp) {
    		let dot = {};
    		dot.patientId = d.patient;
    		dot.diagnosisGroups = diagGrp;

    		diagnosisDots.push(dot);
    	});
    });

    let widthPerPatient = (chartWidth - gapBetweenYAxisAndXAxis*2)/(xDomain.length - 1);
    let patientsNumDisplay = 4;

    // Show the first patientsNumDisplay patients by default
    let defaultPatients = xDomain.slice(0, patientsNumDisplay);
    
	// Set the ranges
	let x = d3.scalePoint()
	    .domain(defaultPatients)
	    .range([gapBetweenYAxisAndXAxis, overviewWidth]);
	    
	let overviewX = d3.scalePoint()
	    .domain(xDomain)
	    .range([gapBetweenYAxisAndXAxis, overviewWidth]);

	let y = d3.scalePoint()
	    .domain(data.diagnosisGroups)
		.range([0, chartHeight - chartTopMargin - svgPadding.bottom - gapBetweenYAxisAndXAxis]);

	let overviewY = d3.scalePoint()
	    .domain(data.diagnosisGroups)
		.range([0, overviewHeight]);
	
	// Replace all spaces, commas, and () with underscores
    let diagnosis2Class = function(diagnosis) {
        return diagnosis.replace(/ |,|\(|\)|/g, "_");
    };

	// Chart title
    svg.append("text")
        .attr("class", "diagnosis_chart_title")
        .attr("transform", function(d) { 
			return "translate(" + svgWidth/1.5 + ", " + svgPadding.top + ")"; 
		})
        .text("Diagnosis");

	// Patient diagnosis dots
	diagnosisChartGrp.selectAll(".diagnosis_dot")
		.data(diagnosisDots.filter(function(obj) {
			// By default only show the dots of patients in the x.domain()
			return x.domain().indexOf(obj.patientId) !== -1
		}))
		.enter().append("circle")
		.attr("class", function(d) {
			return "diagnosis_dot " + d.patientId;
		})
		.attr("cx", function(d, i) {
            return x(d.patientId);
		})
		.attr("cy", function(d) { 
            return y(d.diagnosisGroups);
		})
		.attr("r", diagnosisDotRadius)
		.attr("fill", dotColor);
		
		
	// Add the x Axis
	diagnosisChartGrp.append("g")
		.attr("transform", "translate(0," + (chartHeight - chartTopMargin - svgPadding.bottom) + ")")
		.attr("class", "diagnosis_x_axis");
    
    createXAxis();

    // Will be reused when moving slider
	function createXAxis() {
		diagnosisChartGrp.append("g")
			.attr("transform", "translate(0," + (chartHeight - chartTopMargin - svgPadding.bottom) + ")")
			.attr("class", "diagnosis_x_axis")
			.call(d3.axisBottom(x))
				.selectAll("text")	
				.attr("class", "diagnosis_x_label")
		        .on("mouseover", function(d) {
		            // Highlight all dots of this patient
		            d3.selectAll("." + d)
		                .attr("r", highlightedDotRadius)
		                .attr("fill", highlightedDotColor);

		            // Insert instead of append() guideline so it gets covered by dots
		            d3.select(".diagnosis_chart_group").insert("line", ":first-child")
						.attr("class", "diagnosis_guideline")
						.attr("x1", x(d))
						.attr("y1", 0)
						.attr("x2", x(d))
						.attr("y2", chartHeight - chartTopMargin);

					// Also highlight the corresponding Y labels
					data.patients[d].forEach(function(diagnosis) {
						$("." + diagnosis2Class(diagnosis)).addClass("highlighted_diagnosis_label");
					});
		        })
		        .on("mouseout", function(d) {
		            // Reset dot size and color
		            d3.selectAll("." + d)
		                .attr("r", diagnosisDotRadius)
		                .attr("fill", dotColor);

		            // Remove added guideline
		            d3.selectAll(".diagnosis_guideline").remove();

		            // Also dehighlight the corresponding Y labels
					data.patients[d].forEach(function(diagnosis) {
						$("." + diagnosis2Class(diagnosis)).removeClass("highlighted_diagnosis_label");
					});
		        });
	}

	// Add the y Axis
	diagnosisChartGrp.append("g")
		.call(d3.axisLeft(y))
		// Now add class to the label text
		.selectAll("text")
		.attr("class", function(d) {
			return diagnosis2Class(d);
		})
		// Replace underscore with white space
		.text(function(d) {
			return d;
		});

    // Only show the slider when there are more patients than patientsNumDisplay
	if (xDomain.length > patientsNumDisplay) {
        createSlider();
	}

	function createSlider() {
        // Overview area with slider
		let overview = svg.append("g")
		    .attr("class", "overview")
		    .attr("transform", "translate(" + svgPadding.left + "," + (svgPadding.top + chartHeight + gapBetweenYAxisAndXAxis) + ")");

		overview.selectAll(".overview_diagnosis_dot")
			.data(diagnosisDots)
			.enter().append("g").append("circle")
			.attr('class', 'overview_diagnosis_dot')
			.attr("cx", function(d) {
	            return overviewX(d.patientId);
			})
			.attr("cy", function(d) { 
	            return overviewY(d.diagnosisGroups);
			})
			.attr("r", overviewDotRadius)
			.attr("fill", dotColor);

	    // Add overview step slider 
	    let sliderWidth = widthPerPatient * (patientsNumDisplay - 1) + 2*overviewDotRadius;

        // Highlight the target patients in target patients list by default
        highlightTargetPatients(defaultPatients);

        let drag = d3.drag()
            .on("drag", dragged);

		overview.append("rect")
		    .attr("class", "slider")
		    .attr("x", gapBetweenYAxisAndXAxis - overviewDotRadius)
			.attr("y", -overviewDotRadius) // take care of the radius
			.attr("width", sliderWidth) 
			.attr("height", overviewHeight + 2*overviewDotRadius)
			.attr("pointer-events", "all")
			.attr("cursor", "ew-resize")
			.call(drag);

	    function dragged(d) {
	        let dragX = d3.event.x;

            // Restrict start and end point of the slider
            const beginX = 0;
            // endX is always the x position of the first patient dot in the slider
            // when the slider is moved to the very end
            const endX = overviewX(xDomain[xDomain.length - patientsNumDisplay]) - overviewDotRadius * 2;

            if (dragX < beginX) {
            	dragX = beginX;
            }

            if (dragX > endX) {
            	dragX = endX;
            }

	        // Now we need to know the start and end index of the domain array
	        let startIndex = Math.floor(dragX/widthPerPatient);

            // Step Slider
			let midPoint = (overviewX(xDomain[startIndex]) + overviewX(xDomain[startIndex + 1]))/2;

			let targetIndex = null;
			if (dragX < midPoint) {
				targetIndex = startIndex;
			} else {
				targetIndex = startIndex + 1;
			}

            let endIndex = targetIndex + patientsNumDisplay;
            
			// Move the slider rect to new position
			let newX = overviewX(xDomain[targetIndex]) - overviewDotRadius;

			d3.select(this).attr("x", newX);
	 
	        // Element of endIndex is not included
	        let newXDomain = xDomain.slice(targetIndex, endIndex);

	        // Update x domain
	        x.domain(newXDomain);

	        // Remove and recreate the x axis
	        diagnosisChartGrp.selectAll(".diagnosis_x_axis").remove();
	        createXAxis();

	        let newDiagnosisDots = diagnosisDots.filter(function(obj) {
	        	return newXDomain.indexOf(obj.patientId) !== -1
	        });

	        // Remove all old dots
	        diagnosisChartGrp.selectAll(".diagnosis_dot").remove();

	        // Recreate and position the new dots
	        diagnosisChartGrp.selectAll(".diagnosis_dot")
				.data(newDiagnosisDots)
				.enter().append("circle")
				.attr("class", function(d) {
					return "diagnosis_dot " + d.patientId;
				})
				.attr("cx", function(d) {
		            return x(d.patientId);
				})
				.attr("cy", function(d) { 
		            return y(d.diagnosisGroups);
				})
				.attr("r", 4)
				.attr("fill", dotColor);

			// Also highlight the target patients in the patient list
            $(".target_patient").removeClass("highlighted_target_patient_in_diagnosis");
			highlightTargetPatients(newXDomain);
		};
	}
}

function highlightTargetPatients(patientsArr) {
    patientsArr.forEach(function(patient) {
        $("#" + patient).addClass("highlighted_target_patient_in_diagnosis");
	});
}

// We do NOT remove the biomarkers patients chart on each redraw, due to the animation
function showBiomarkersOverviewChart(svgContainerId, data) {
    const svgWidth = 380;
    const svgHeight = 100;
	const svgPadding = {top: 5, right: 10, bottom: 10, left: 140};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	const chartTopMargin = 35;

	let yLables = [];
	data.forEach(function(obj) {
	    yLables.push(obj.label);
	});

    // Band scale of biomarkers
    let y = d3.scaleBand()
        .domain(yLables)
	    .range([0, chartHeight - chartTopMargin])
	    .padding(0.2);

    // Percentage X
	let x = d3.scaleLinear()
	    .domain([0, 1])
	    .range([0, chartWidth]);

    // https://github.com/d3/d3-format
    // keep one decimal in percentage, like 45.5%
    let formatPercentBarText = d3.format(".1%");

    // No decimal, like 45%
    let formatPercentAxisTick = d3.format(".0%");

    // Only draw everything for the first time
    if (d3.select(".biomarkers_overview_chart_group").empty()) {
	    let svg = d3.select("#" + svgContainerId).append("svg")
		    .attr("class", "biomarkers_overview_chart") // Used for CSS styling
			.attr("width", svgWidth)
			.attr("height", svgHeight);
		
		// Chart title
	    svg.append("text")
	        .attr("class", "biomarkers_chart_title")
	        .attr("transform", function(d) { 
				return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
			})
	        .text("Biomarkers Overview");

		let biomarkersPatientsChartGrp = svg.append("g")
			    .attr("class", "biomarkers_overview_chart_group")
			    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

        // Bars
        let barGrp = biomarkersPatientsChartGrp.selectAll(".biomarkers_overview_chart_bar_group")
            .data(data)
            .enter().append("g")
            .attr("class", "biomarkers_overview_chart_bar_group");

        // Bar
        barGrp.append("rect")
            .attr("class", "biomarkers_overview_chart_bar")
			.attr("x", 0)
			.attr("y", function(d) { 
				return y(d.label); 
			})
			.attr("height", y.bandwidth())
			.transition()
	        .duration(transitionDuration)
			.attr("width", function(d) {
				return x(d.count);
			});
        
        // Percentage text
        barGrp.append("text")
			.attr("id", function(d) {
                return d.label + "_" + d.status;
			})
			.attr("class", "biomarkers_overview_chart_bar_percentage")
			.attr("x", 5)
			.attr("y", function(d) { 
				return y(d.label) + y.bandwidth()/2; 
			})
			.text(function(d) {
				return formatPercentBarText(d.count);
            });

	    // Y axis
		biomarkersPatientsChartGrp.append("g")
			.attr("class", "biomarkers_overview_chart_y_axis")
			.call(d3.axisLeft(y));

	    // X axis
		biomarkersPatientsChartGrp.append("g")
			.attr("class", "biomarkers_overview_chart_x_axis")
			.attr("transform", "translate(0," + (chartHeight - chartTopMargin) + ")")
			.call(d3.axisBottom(x).tickFormat(formatPercentAxisTick));
    } else {
        // Update the data
        let biomarkersPatientsGrp = d3.selectAll(".biomarkers_overview_chart_group").selectAll(".biomarkers_overview_chart_bar_group")
			.data(data);

	    // Update the bar width for each category
		biomarkersPatientsGrp.select(".biomarkers_overview_chart_bar")
		    .transition()
            .duration(transitionDuration)
    	    .attr("width", function(d) {
    	    	return x(d.count);
    	    });
			

    	// Update the percentage text
		biomarkersPatientsGrp.select(".biomarkers_overview_chart_bar_percentage")
			.text(function(d) {
				return formatPercentBarText(d.count);
            });
    }
}


// We do NOT remove the biomarkers chart on each redraw, due to the animation
function showPatientsWithBiomarkersChart(svgContainerId, data) {
    const svgWidth = 370;
    const svgHeight = 130;
	const svgPadding = {top: 10, right: 10, bottom: 15, left: 50};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	const chartTopMargin = 30;

    const legendGroupWidth = 55;
    const legendRectSize = 8;
    const legnedTextRectPad = 2;

    // Band scale of biomarkers
    let y = d3.scaleBand()
        .domain(data.biomarkersPool)
	    .range([0, chartHeight - chartTopMargin])
	    .padding(0.2);

    // Percentage X
	let x = d3.scaleLinear()
	    .domain([0, 1])
	    .range([0, chartWidth - legendGroupWidth]);

    // Colors of status: positive, negative, unknown
    let color = d3.scaleOrdinal()
        .range(["rgb(214, 39, 40)", "rgb(44, 160, 44)", "rgb(150, 150, 150)"]);

    // https://github.com/d3/d3-format
    // keep one decimal in percentage, like 45.5%
    let formatPercentBarText = d3.format(".1%");

    // No decimal, like 45%
    let formatPercentAxisTick = d3.format(".0%");

    // Create the stack data structure
    // https://github.com/d3/d3-shape/blob/master/README.md#stack
	var stack = d3.stack()
	    .keys(data.biomarkerStatus)
	    .order(d3.stackOrderNone)
	    .offset(d3.stackOffsetNone);

	var stackData = stack(data.data);

    // Only draw everything for the first time
    if (d3.select(".biomarkers_chart_group").empty()) {
	    let svg = d3.select("#" + svgContainerId).append("svg")
		    .attr("class", "biomarkers_chart") // Used for CSS styling
			.attr("width", svgWidth)
			.attr("height", svgHeight);
		
		let biomarkersChartGrp = svg.append("g")
			    .attr("class", "biomarkers_chart_group")
			    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

	    // Chart title
	    svg.append("text")
	        .attr("class", "biomarkers_chart_title")
	        .attr("transform", function(d) { 
				return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
			})
	        .text("Patients With Biomarkers Found");

	    let biomarkerStatusGrp = biomarkersChartGrp.selectAll(".biomarker_status_group")
			.data(stackData)
			.enter().append("g")
			.attr("class", function(d) {
				return "biomarker_status_group " + d.key;
			})
			.attr("fill", function(d) {
                return color(d.key);
			});

	    // Status bars inside each biomarker group
		biomarkerStatusGrp.selectAll(".biomarker_status_bar")
		    // here d is each object in the stackData array
			.data(function(d) {
				return d;
			})
			.enter().append("rect")
			.attr("class", "biomarker_status_bar")
			.attr("x", function(d) {
                return x(d[0]);
			})
			.attr("y", function(d) { 
				return y(d.data.biomarker); 
			})
			.attr("height", y.bandwidth())
			.transition()
	        .duration(transitionDuration)
			.attr("width", function(d) { 
				// Return the absolute value to avoid errors due to negative value
    	    	return Math.abs(x(d[1]) - x(d[0]));
			});

        // Append the percentage text
        biomarkerStatusGrp.selectAll(".biomarker_status_percentage")
		    // here d is each object in the stackData array
			.data(function(d) {
				// Add status property to make it available in the text()
				d.forEach(function(item) {
					item.status = d.key;
				});

				return d;
			})
			.enter().append("text")
			.attr("id", function(d) {
                return d.data.biomarker + "_" + d.status;
			})
			.attr("class", "biomarker_status_percentage")
			.attr("x", function(d) {
                return x(d[0]) + 5; // Add 5px margin to left
			})
			.attr("y", function(d) { 
				return y(d.data.biomarker) + y.bandwidth()/2; 
			})
			.text(function(d) {
				// Only show percentage text for values bigger than 10%
				if (d.data[d.status] > 0.1) {
					return formatPercentBarText(d.data[d.status]);
				}
            });

	    // Y axis
		biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_y_axis")
			.call(d3.axisLeft(y))
			// Now modify the label text to add patients count
			.selectAll("text")
			.text(function(d) {
				if (d === "has_ER_Status") {
                    return "ER";
				} else if (d === "has_PR_Status") {
                    return "PR";
				} else if (d === "has_HER2_Status") {
					return "HER2/Neu";
				} else {
					return d.replace("_", " ");
				}
			});

	    // X axis
		biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_x_axis")
			.attr("transform", "translate(0," + (chartHeight - chartTopMargin) + ")")
			.call(d3.axisBottom(x).tickFormat(formatPercentAxisTick));

	    // Status legend
		let legend = biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_legend")
			.selectAll("g")
			.data(data.biomarkerStatus)
			.enter().append("g")
			.attr("transform", function(d, i) { 
				return "translate(0," + i * (legendRectSize + legnedTextRectPad) + ")"; 
			});

		legend.append("rect")
		    .attr("class", "biomarker_status_legend")
			.attr("x", chartWidth - legendRectSize)
			.attr("width", legendRectSize)
			.attr("height", legendRectSize)
			.attr("fill", function(d) { 
				return color(d); 
			})
			.attr("stroke", function(d) { 
				return color(d); 
			});

		legend.append("text")
		    .attr("class", "biomarker_status_legend_text")
			.attr("x", chartWidth - legendRectSize - legnedTextRectPad)
			.attr("y", 9)
			.text(function(d) { 
				// Capitalized
				return d.charAt(0).toUpperCase() + d.slice(1);; 
			});
    } else {
        // Update the data
        let biomarkerStatusGrp = d3.selectAll(".biomarkers_chart_group").selectAll(".biomarker_status_group")
			.data(stackData);

	    // Update the status bars position and width
		biomarkerStatusGrp.selectAll(".biomarker_status_bar")
		    // here d is each object in the stackData array
			.data(function(d) {
				return d;
			})
			.attr("x", function(d) {
                return x(d[0]);
			})
			.transition()
            .duration(transitionDuration)
    	    .attr("width", function(d, i) {
    	    	// Return the absolute value to avoid errors due to negative value
    	    	// during transitioning from one stage to another stage
    	    	return Math.abs(x(d[1]) - x(d[0]));
    	    });

        // Update the percentage text and x position
        biomarkerStatusGrp.selectAll(".biomarker_status_percentage")
		    // here d is each object in the stackData array
			.data(function(d) {
				// Add status property to make it available in the text()
				d.forEach(function(item) {
					item.status = d.key;
				});

				return d;
			})
			.attr("x", function(d) {
                return x(d[0]) + 5;
			})
			.text(function(d) {
				// Only show percentage text for values bigger than 10%
				if (d.data[d.status] > 0.1) {
                    return formatPercentBarText(d.data[d.status]);
				}
            });
    }
}
//Patient List Per Label
function showPatientsListLabel(containerId, data) {
    //removeChart(containerId);
    //console.log(data)

	 console.log(data)
	   

    let html = '<ul class="patient_list">';

    data.forEach(function(patientId) {
    	html += '<li><a id="' + patientId+ '" class="target_patient" href="' + baseUri + '/patient/' + patientId+ '" target="_blank">' + patientId.substring(8) + '</a> </li>';
    });
    	//html += '<li><a ' +  '>' + patientId + '</a> </li>';

   
    //});

    html += '</ul>';
    
    $("#" + containerId).html(html);
}




function showHeatMap(svgContainerId, data) 
{
	removeChart(svgContainerId);
	
// set the dimensions and margins of the graph
var margin = {top: 15, right: 30, bottom: 30, left: 60},
  width = 720 - margin.left - margin.right,
  height = 220 - margin.top - margin.bottom;

values=data;
// append the svg object to the body of the page
var svg = d3.select("#HeatMap").append('svg')
		.attr("width", width + margin.left + margin.right)
  		.attr("height", height + margin.top + margin.bottom)
		.append("g")
  		.attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

//Read the data
var Labels=["FindingCount", "DrugCount", "DisorderCount", "LabCount", "ProcedureCount","OtherCount"]

  // Labels of row and columns -> unique identifier of the column called 'group' and 'variable'
  

  // Build X scales and axis:

  minMonth= d3.min(values, (item) => {
            return item['month']
        })
        //console.log(minMonth)

  maxMonth=d3.max(values, (item) => {
          return item['month']
        })
  var months=[];
  values.forEach(function(m){   
  		months.push(m.month)})   
    	
 var x = d3.scaleBand()
        .domain(months)
        .range([minMonth, maxMonth +500])
        .padding(5)
        svg.append("g")
    	.style("font-size", 8)
    	.attr("transform", "translate(0," + height + ")")
    	.call(d3.axisBottom(x).tickSize(0).ticks(20))
    	.select(".domain").remove()





  var y= d3.scaleBand()//d3.scaleTime
         .domain(Labels)
         .range([height,0])
          .padding(0.5)
         
         svg.append("g")
    	.style("font-size", 8)
    	.call(d3.axisLeft(y).tickSize(0))
    	.call(g => g.select(".domain").remove())
    	.selectAll("text")
    	.text(function(d) 
				{
				if (d === "FindingCount") 
					{
                    return "Finding";
					} 
					else if (d === "DrugCount") 
					{
                    return "Drug";
					}
					else if (d === "LabCount") 
					{
					return "LAB";
					} 
					else if (d === "DisorderCount") 
					{
					return "Disorder";
					} 
					else if (d === "ProcedureCount") 
					{
					return "Procedure";
					} 
					else if (d === "OtherCount")
					 {
					return "Other";
					} 
					else 
					{
					return d.replace("_", " ");
					}

				})

    	
		

  // Build color scale
 // var myColor =d3.scaleSequentialQuantile().domain([100, 1, 13]) //d3.scaleSequential()
  //.interpolator(d3.interpolateCubehelixDefault)
  //.interpolator(d3.interpolatePRGn)
    //.interpolator(d3.interpolate("purple", "orange"))
    //.domain([1,500])
    //d3.scaleSequentialLog(d3.interpolatePuBuGn).domain([1e-8, 1e8])

  // create a tooltip
  var tooltip = d3.select("#HeatMap")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px")

  // Three function that change the tooltip when user hover / move / leave a cell
  var mouseover = function(d) {
    tooltip
      .style("opacity", 1)
    d3.select(this)
      .style("stroke", "black")
      .style("opacity", 1)
  }
  var mousemove = function(d) {
    tooltip
    
      .html("Year" + " " + d.year + 
      		"<br> month: " + d.month +  
    		"<br> Label: " + d.field.substr(0,d.field.indexOf('C')) + 
    		"<br> value: " + d.value )
      .style("left", (d3.mouse(this)[0]+100) + "px")
      .style("top", (d3.mouse(this)[1] + 10)+"px")
  }
  var mouseleave = function(d) {
    tooltip
      .style("opacity", 0)
    d3.select(this)
      .style("stroke", "none")
      .style("opacity", 0.8)
  }

  // add the squares
  svg.selectAll()
    .data(data, function(d) {return d.month+':'+d.field;})
    .enter()
    .append("rect")
      .attr("x", function(d) { return x(d.month) })
      .attr("y", function(d) { return y(d.field) })
     .attr("rx", 2)
     .attr("ry", 2)
      .attr("width", 10 )
      .attr("height", 10 )
      .style('fill', function(d) 
        {
            frequency= d.value
            if(frequency == 0){
            	return '#ffffd9'
         	}
          if(frequency <= 25){
                return '#edf8b1'
            }else if(frequency<=50){
                return  '#c7e9b4'
            } else if(frequency <=75) {
                return '##7fcdbb'
            } else if(frequency <=100){
                return '#41b6c4'
            }else if(frequency <=200){
                return '#1d91c0'
            }else if(frequency <= 300){
                return '#225ea8'
            } else if(frequency <=500){
                return '#253494'
            }else if (frequency <=1000){
            return '#081d58'
            } else { return 'Red'}
        })
      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", 0.8)
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseleave", mouseleave)
    .on("click", function(d) {  
			let clickedCell = d3.select(this);	
         	hasBeenClicked = true;
         	if(hasBeenClicked){
         	patientByLabel = d.patienList;
         	getLabelEpisode(d.patienList);
         	console.log(d.patienList)
        	removeChart("patients");
        	showPatientsListLabel("patients", patientByLabel)
        	hasBeenClicked= false
        	}
        	else{
        	patientByLabel = allPatients;
         	getLabelEpisode(patientByLabel);
         	//console.log(d.patienList)
        	removeChart("patients");
        	showPatientsListLabel("patients", patientByLabel)
        	hasBeenClicked= true
        	}

        	}) 

var borderPath = svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("height", height)
  .attr("width", width)
  .style("stroke", "black")
  .style("fill", "none")
  .style("stroke-width", 1);

  svg.append("text")
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height+20  ) + ")")
      .attr('font-size', 9)
		.style("text-anchor", "middle")
      	.text("Number of Months");


// Add title to graph
svg.append("text")
        .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height-180  ) + ")")
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text("Label Frequency: Document Records from 2000 to 2014");

        //create Legend   
svg.append("rect")
		
		.attr("x",width/2 +60)
		.attr("y",height + 15)
		.attr("width",8)
		.attr("height",8).style("fill","#ffffd9")
svg.append("text")
		.attr("x", width/2 +62)
		.attr("y", height + 28)
		.text("0")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +68)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#edf8b1")
svg.append("text")
		.attr("x", width/2 +70)
		.attr("y", height + 28)
		.text("<=25")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +98)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#c7e9b4")
svg.append("text")
		.attr("x", width/2 +102)
		.attr("y", height + 28)
		.text("<=50")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +128)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#7fcdbb")
svg.append("text")
		.attr("x",width/2 +132)
		.attr("y", height + 28)
		.text("<=75")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +158)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#41b6c4")
svg.append("text")
		.attr("x", width/2 +162)
		.attr("y", height + 28)
		.text("<=100")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +188)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#1d91c0")
svg.append("text")
		.attr("x", width/2 +192)
		.attr("y", height + 28)
		.text("<=200")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +218)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#225ea8")
svg.append("text")
		.attr("x", width/2 +222)
		.attr("y", height + 28)
		.text("<=300")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +248)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#253494")
svg.append("text")
		.attr("x", width/2 +249)
		.attr("y", height + 28)
		.text("<=500")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +278)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#081d58")
svg.append("text")
		.attr("x", width/2 +279)
		.attr("y", height + 28)
		.text("<=1000")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")
svg.append("rect")
		.attr("x",width/2 +308)
		.attr("y",height + 15)
		.attr("width",25)
		.attr("height",8)
		.style("fill","red")
svg.append("text")
		.attr("x", width/2 +311)
		.attr("y", height + 28)
		.text(">1000")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

}

//Prevlance of the Label per each month

function showHeatMap1(svgContainerId, data) 
{
	removeChart(svgContainerId);
	
// set the dimensions and margins of the graph
var margin = {top: 15, right: 30, bottom: 30, left: 60},
  width = 720 - margin.left - margin.right,
  height = 220 - margin.top - margin.bottom;

values=data;
// append the svg object to the body of the page
var svg = d3.select("#HeatMap1").append('svg')
		.attr("width", width + margin.left + margin.right)
  		.attr("height", height + margin.top + margin.bottom)
		.append("g")
  		.attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

//Read the data
var Labels=["FindingCount", "DrugCount", "DisorderCount", "LabCount", "ProcedureCount","OtherCount"]

  // Labels of row and columns -> unique identifier of the column called 'group' and 'variable'
  

  // Build X scales and axis:

  minMonth= d3.min(values, (item) => {
            return item['month']
        })
        //console.log(minMonth)

  maxMonth=d3.max(values, (item) => {
          return item['month']
        })
  var months=[];
  values.forEach(function(m){   
  		months.push(m.month)})   
    	
 var x = d3.scaleBand()
        .domain(months)
        .range([minMonth, maxMonth +500])
        .padding(5)
        svg.append("g")
    	.style("font-size", 8)
    	.attr("transform", "translate(0," + height + ")")
    	.call(d3.axisBottom(x).tickSize(0).ticks(20))
    	.select(".domain").remove()





  var y= d3.scaleBand()//d3.scaleTime
         .domain(Labels)
         .range([height,0])
          .padding(0.5)
         
         svg.append("g")
    	.style("font-size", 8)
    	.call(d3.axisLeft(y).tickSize(0))
    	.call(g => g.select(".domain").remove())
    	.selectAll("text")
    	.text(function(d) 
				{
				if (d === "FindingCount") 
					{
                    return "Finding";
					} 
					else if (d === "DrugCount") 
					{
                    return "Drug";
					}
					else if (d === "LabCount") 
					{
					return "LAB";
					} 
					else if (d === "DisorderCount") 
					{
					return "Disorder";
					} 
					else if (d === "ProcedureCount") 
					{
					return "Procedure";
					} 
					else if (d === "OtherCount")
					 {
					return "Other";
					} 
					else 
					{
					return d.replace("_", " ");
					}

				})

    	
		

  // Build color scale
 // var myColor =d3.scaleSequentialQuantile().domain([100, 1, 13]) //d3.scaleSequential()
  //.interpolator(d3.interpolateCubehelixDefault)
  //.interpolator(d3.interpolatePRGn)
    //.interpolator(d3.interpolate("purple", "orange"))
    //.domain([1,500])
    //d3.scaleSequentialLog(d3.interpolatePuBuGn).domain([1e-8, 1e8])

  // create a tooltip
  var tooltip = d3.select("#HeatMap1")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px")

  // Three function that change the tooltip when user hover / move / leave a cell
  var mouseover = function(d) {
    tooltip
      .style("opacity", 1)
    d3.select(this)
      .style("stroke", "black")
      .style("opacity", 1)
  }
  var mousemove = function(d) {
    tooltip
    
      .html("Year" + " " + d.year + 
      		"<br> month: " + d.month +  
    		"<br> Label: " + d.field.substr(0,d.field.indexOf('C')) + 
    		"<br> value: " + d.value1 + "%")
      .style("left", (d3.mouse(this)[0]+100) + "px")
      .style("top", (d3.mouse(this)[1] + 10)+"px")
  }
  var mouseleave = function(d) {
    tooltip
      .style("opacity", 0)
    d3.select(this)
      .style("stroke", "none")
      .style("opacity", 0.8)
  }

  // add the squares
  svg.selectAll()
    .data(data, function(d) {return d.month+':'+d.field;})
    .enter()
    .append("rect")
      .attr("x", function(d) { return x(d.month) })
      .attr("y", function(d) { return y(d.field) })
     .attr("rx", 2)
     .attr("ry", 2)
      .attr("width", 10 )
      .attr("height", 10 )
      .style('fill', function(d) 
        {
            frequency= d.value1
            if(frequency == 0)
            {
            	return '#ffffd9'
            }
          	else if(frequency <= 25)
          	{
                return '#7fcdbb'
            }
            else if(frequency<=50)
            {
                return  '#225ea8'
            } 
            else if(frequency <=75)
            {
                return '#081d58'
            } 
            else (frequency <=100)
            {
                return 'Red'
            }
          
        })
      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", 0.8)
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseleave", mouseleave)
    .on("click", function(d) {  
			let clickedCell = d3.select(this);	
         	hasBeenClicked = true;
         	if(hasBeenClicked){
         	patientByLabel = d.patienList;
         	getLabelEpisode(d.patienList);
         	console.log(d.patienList)
        	removeChart("patients");
        	showPatientsListLabel("patients", patientByLabel)
        	hasBeenClicked= false
        	}
        	else{
        	patientByLabel = allPatients;
         	getLabelEpisode(patientByLabel);
         	//console.log(d.patienList)
        	removeChart("patients");
        	showPatientsListLabel("patients", patientByLabel)
        	hasBeenClicked= true
        	}

        	}) 

var borderPath = svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("height", height)
  .attr("width", width)
  .style("stroke", "black")
  .style("fill", "none")
  .style("stroke-width", 1);

  svg.append("text")
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height+20  ) + ")")
      .attr('font-size', 9)
		.style("text-anchor", "middle")
      	.text("Number of Months");


// Add title to graph
svg.append("text")
        .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height-180  ) + ")")
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text("Label Prevlance per each month");

        //create Legend 
svg.append("rect")
		
		.attr("x",width/2 +70)
		.attr("y",height + 15)
		.attr("width",8)
		.attr("height",8).style("fill","#ffffd9'")
svg.append("text")
		.attr("x", width/2 +72)
		.attr("y", height + 28)
		.text("0")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")
     
            

       
svg.append("rect")
		.attr("x",width/2 +78)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#7fcdbb")
svg.append("text")
		.attr("x", width/2 +80)
		.attr("y", height + 28)
		.text("<=25")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +108)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#225ea8")
svg.append("text")
		.attr("x", width/2 +112)
		.attr("y", height + 28)
		.text("<=50")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +138)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","#081d58")
svg.append("text")
		.attr("x",width/2 +142)
		.attr("y", height + 28)
		.text("<=75")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +168)
		.attr("y",height + 15)
		.attr("width",30)
		.attr("height",8)
		.style("fill","red")
svg.append("text")
		.attr("x", width/2 +172)
		.attr("y", height + 28)
		.text("<=100")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")



}
//*********************************************************************************
//****************** Sankey D3****************************************************
function showEpisode(svgContainerId, data) 
{
	removeChart(svgContainerId);
	console.log(data)

   var margin = {top: 15, right: 10, bottom: 40, left: 10},
    width = 550 - margin.left - margin.right,
    height = 250 - margin.top - margin.bottom;
 //schemeSet1

    color = d3.scaleOrdinal(d3.schemeSet1);

// append the svg canvas to the page
var svg = d3.select("#" + svgContainerId).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  	.append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

    svg.append("text")
		.attr("class", "Sankey_title")
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (0-margin.top)  + ")")
		.style("text-anchor", "middle")
      	.text("Overview of Episode Sequence");

    svg.append("rect")
		.attr("x",width -499)
		.attr("y",height +15 )
		.attr("width",330)
		.attr("height",20)
		.style("stroke", "#667292")
  		.style("fill", "none")
  		.style("stroke-width", 1);
		
    svg.append("rect")
		.attr("x",width -495)
		.attr("y",height+20)
		.attr("width",5)
		.attr("height",10).style("fill","#ff8080")
	svg.append("text")
		.attr("x", width -488)
		.attr("y", height+27)
		.text("Prediagnostic")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")
	
	svg.append("rect")
		.attr("x",width -430)
		.attr("y",height+20)
		.attr("width",5)
		.attr("height",10).style("fill","#ffb380")
	svg.append("text")
		.attr("x", width -423)
		.attr("y", height+27)
		.text("Diagnostic")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

	svg.append("rect")
		.attr("x",width -376)
		.attr("y",height+20)
		.attr("width",5)
		.attr("height",10).style("fill","#7DCEA0")
	svg.append("text")
		.attr("x", width -370)
		.attr("y", height+27)
		.text("Treatment")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

	svg.append("rect")
		.attr("x",width -325)
		.attr("y",height+20)
		.attr("width",5)
		.attr("height",10).style("fill","#d9b3ff")
	svg.append("text")
		.attr("x", width -317)
		.attr("y", height+27)
		.text("Medical Decision Making")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

		svg.append("rect")
		.attr("x",width -223)
		.attr("y",height+20)
		.attr("width",5)
		.attr("height",10).style("fill","#4dc3ff")
	svg.append("text")
		.attr("x", width -214)
		.attr("y", height+27)
		.text("Follow-Up")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")


  /*var borderPath = svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("height", height)
  .attr("width", width)
  .style("stroke", "black")
  .style("fill", "none")
  .style("stroke-width", 1);*/
 
// Set the sankey diagram properties
var sankey = d3.sankey()
    .nodeWidth(10)
    .nodePadding(10)
    .size([width, height]);
 
var path = sankey.link();
 
// load the data

    var nodeMap = {};
    data.nodes.forEach(function(x) { nodeMap[x.name] = x; });
    data.links = data.links.map(function(x) {
      return {
        source: nodeMap[x.source],
        target: nodeMap[x.target],
        value: x.value,
        patienList: x.patienList
      };
    });
 
  sankey
      .nodes(data.nodes)
      .links(data.links)
      .layout(35);
 
// add in the links
  var link = svg.append("g").selectAll(".link")
      .data(data.links)
    .enter().append("path")
      .attr("class", "link")
      .attr("d", path)
      .style("stroke-width", function(d) { return Math.max(1, d.dy); })
      .sort(function(a, b) { return b.dy - a.dy; })
      .on("click", function(d) {  
         	let clickedCell = d3.select(this);	
         	patientByLabel = d.patienList;
         	console.log(d.patienList)
        	removeChart("patients")
        	showPatientsListLabel("patients", d.patienList)
        	getEpisodeLabel(d.patienList)

        	}) 
 
// add the link titles
  link.append("title")
        .text(function(d) {
      	return d.source.name.substr(0,d.source.name.indexOf(' ')) + " → " + 
                d.target.name.substr(0,d.target.name.indexOf(' ')) + "\n" + d.value; })
    
 
// add in the nodes
  var node = svg.append("g").selectAll(".node")
      .data(data.nodes)
    .enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { 
		  return "translate(" + d.x + "," + d.y + ")"; })
    .call(d3.drag()
     .subject(function(d) { return d; })
      .on("start", function() { 
		  this.parentNode.appendChild(this); })
      .on("drag", dragmove));
 
// add the rectangles for the nodes
  node.append("rect")
      .attr("height", function(d) { return d.dy; })
      .attr("width", sankey.nodeWidth())
      .style("fill", function(d) { 
		  return d.color = color(d.name.replace(/ .*/, "")); })
      .style("stroke", function(d) { 
		  return d3.rgb(d.color).darker(1); })
    .append("title")
      .text(function(d) { 
		  return d.name.substr(0,d.name.indexOf(' ')) + "\n" + d.value; })
      
 
// add in the title for the nodes
 /* node.append("text")
      .attr("x", -6)
      .attr("y", function(d) { return d.dy / 2; })
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("transform", null)
      .text(function(d) { return d.name; })
    .filter(function(d) { return d.x < width / 2; })
      .attr("x", 6 + sankey.nodeWidth())
      .attr("text-anchor", "start");*/
 
// the function for moving the nodes
  function dragmove(d) {
    d3.select(this).attr("transform", 
        "translate(" + (
        	   d.x = Math.max(0, Math.min(width - d.dx, d3.event.x))
        	) + "," + (
                   d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
            ) + ")");
    sankey.relayout();
    link.attr("d", path);
  }

}
//********************************************************************************


function getBiomarkers(patientIds) {
    $.ajax({
	    url: baseUri + '/biomarkers/' + patientIds.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
	    //console.log(response);
	    showBiomarkersOverviewChart("biomarkers_overview", response.biomarkersOverviewData);
	    showPatientsWithBiomarkersChart("patients_with_biomarkers", response.patientsWithBiomarkersData);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients biomarkers info");
	});
}

function getDiagnosis(patientIds) {
    $.ajax({
	    url: baseUri + '/diagnosis/' + patientIds.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
		console.log("hello diagnosis")
	    showDiagnosisChart("diagnosis", response);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients diagnosis info");
	});
}
function getLabelSummary(patientIds) {
    $.ajax({
	    url: baseUri + '/labels/' + patientIds.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
		//console.log("hello")
		//console.log(response.label)
		showHeatMap("HeatMap", response.label);
		showHeatMap1("HeatMap1", response.label);
		//console.log("This is the Label response");
		//console.log(response.label)
		
		//console.log("This is the Episode Response")
		//console.log('response', response.episode);
		showEpisode("sankey", response.episode);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients labels info");
	});
}
function getLabelEpisode(patientIds){
$.ajax({
	    url: baseUri + '/labels/' + patientIds.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
		//console.log("hello")
		//console.log(response.label)
		//showHeatMap("HeatMap", response.label);
		//console.log("This is the Label response");
		//console.log(response.label)
		
		//console.log("This is the Episode Response")
		//console.log('response', response.episode);
		showEpisode("sankey", response.episode);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients labels info");
	});
}
function getEpisodeLabel(patientIds){
$.ajax({
	    url: baseUri + '/labels/' + patientIds.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
		//console.log("hello")
		//console.log(response.label)
		showHeatMap("HeatMap", response.label);
		showHeatMap1("HeatMap1", response.label);
		//console.log("This is the Label response");
		//console.log(response.label)
		
		//console.log("This is the Episode Response")
		//console.log('response', response.episode);
		//showEpisode("sankey", response.episode);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients labels info");
	});
}




