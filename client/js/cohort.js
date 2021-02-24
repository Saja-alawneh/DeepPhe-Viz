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

var forEach = Array.prototype.forEach;
var links = document.getElementsByTagName('a');
forEach.call(links, function (link) {
link.onclick = function () {
  console.log('Clicked');
    }

});

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
	const svgHeight = 250;
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
		.style("fill", 'red')
		.style("font-weight", "bold")
        .text("Figure 1 - Patient Count Per Stage");

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
		.attr("y", -8)
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
	const svgHeight = 250;

	// svgPadding.top is used to position the chart title
	// svgPadding.left is the space for Y axis labels
	const svgPadding = {top: 1, right: 3, bottom: 20, left: 90};
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
		.style("fill", 'red')
		.style("font-weight", "bold")
        .text("Figure 2 - Patient Age of First Encounter Per Stage");

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

function showResultsTitle2(containerId, data, m, f){
    removeChart(containerId);
    if (f === "FindingCount") 
		{
          f= "Finding"
		} 
	else if (f === "DrugCount") 
		{
            f= "Drug";
		}
	else if (f === "LabCount") 
		{
			f= "LAB";
		} 
	else if (f === "DisorderCount") 
		{
			f= "Disorder";
		} 
	else if (f === "ProcedureCount") 
		{
			f= "Procedure";
		} 
	else 
		{
			f= "Other";
		} 
					


    let html = 'Number of patients with mentions of ' + f + ' in month ' + m + ' is ' +  data.length ;


    $("#" + containerId).html(html);
}

function showResultsTitle3(containerId, data, node, link) {
    removeChart(containerId);

    let html = 'Number of patients with episode transition from ' + link.substr(0,link.indexOf(' ')) + ' episode to ' +  node.substr(0,node.indexOf(' ')) + ' episode is  '+ data.length ;

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
    const svgPadding = {top: 1, right: 20, bottom: 20, left: 170};
    const gapBetweenYAxisAndXAxis = 10;
    const chartTopMargin = 20;
    const xAxisHeight = 20;
    // 15 is the line height of each Y axis label
    const yAxisHeight = data.diagnosisGroups.length * 15;
    const overviewHeight = data.diagnosisGroups.length * overviewDotRadius * 3;
    const svgWidth = 500;
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
			return "translate(" + (svgWidth/2 +50) + ", " + (svgHeight-15) + ")"; 
		})
		.style("fill", 'red')
		.style("font-weight", "bold")
        .text("Figure 8 - Diagnosis");

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
	const svgPadding = {top: 1, right: 45, bottom: 15, left: 140};
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
			.style("fill", 'red')
			.style("font-weight", "bold")
	        .text("Figure 3 - Biomarkers Overview");

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
    const svgWidth = 350;
    const svgHeight = 130;
	const svgPadding = {top: 1, right: 15, bottom: 15, left: 50};
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
			.style("fill", 'red')
			.style("font-weight", "bold")
	        .text("Figure 4 - Patients With Biomarkers Found");

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

	// console.log(data)
	   

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
var margin = {top: 15, right: 20, bottom: 30, left: 70},
  width = 650 - margin.left - margin.right,
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
        .range([minMonth, maxMonth +450])
        .padding(5)
        svg.append("g")
    	.style("font-size", 8)
    	.attr("transform", "translate(0," + height + ")")
    	.call(d3.axisBottom(x).tickSize(4).ticks(20))
    	.select(".domain").remove()

function myFunction (data,label,month)

{
	console.log(data)
    patientLabelList=[] 
    for (i=0; i< data.length; i++)
    {
    if(data[i].field == label && data[i].month == month)
    {
        for (j=0; j< data[i].patienList.length; j++)
        {
            if (!( patientLabelList.includes(data[i].patienList[j])  ))
            {
            patientLabelList.push(data[i].patienList[j])
        //console.log( dataLabel.label[i].patient)
            }
        }
    }

} console.log(label)
    console.log(patientLabelList)
return (patientLabelList)
}



  var y= d3.scaleBand()//d3.scaleTime
         .domain(Labels)
         .range([height,0])
          .padding(0.7)
        
         svg.append("g")
    	.style("font-size", 10)
    	.style("font-weight", "bold")

    	.call(d3.axisLeft(y).tickSize(3))
    	.call(g => g.select(".domain").remove())

    	
    	.on("click", function(d) {  
			let clickedCell = d3.select(this);
			
			let patientsList= myFunction(d.field)
			console.log(patinetList)
			hasBeenClicked = true;
         	if(hasBeenClicked){
         	patientByLabel = patientsList;
         	getLabelEpisode(patientsList);
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
    		"<br> Label Prevalence: " + d.value1 )
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
      .attr("width", 8 )
      .attr("height", 8 )

      .style('fill', function(d) 
        {
            frequency= d.value1
            if(frequency == 0){
            	return '#a6cee3'
         	}
          if(frequency <= 5){
                return '#1f78b4'
            } else if(frequency <=10) {
                return '#b2df8a'
            } else if(frequency <=15){
                return '#33a02c'
            }else if(frequency <=20){
                return '#fb9a99'}
             else if(frequency<=25){
             	return '#e31a1c'
            }else if(frequency <= 30){
                return '#ff7f00'
            } else if(frequency <=50){
                return '#cab2d6'
            } else { return '#6a3d9a'}
        })
      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", 10)
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseleave", mouseleave)
    .on("click", function(d) {  
			let clickedCell = d3.select(this);	
         	hasBeenClicked = true;
         	if(hasBeenClicked){
         	let patientsList= myFunction(data,d.field, d.month)
         	//console.log(patientsList)
         	patientByLabel = d.patienList;
         	getLabelEpisode(d.patienList);
         	//console.log(d.patienList)
        	removeChart("patients");
        	showPatientsListLabel("patients", patientByLabel)
        	showResultsTitle2("results_title", patientByLabel, d.month, d.field)
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
                           (height+30  ) + ")")
      .attr('font-size', 10)
		.style("text-anchor", "middle")
		.style("fill", 'darkblue')
		.style("font-weight", "bold")
      	.text("Number of Months");


// Add title to graph
svg.append("text")
        .attr("transform",
            "translate(" + (width/3) + " ," + 
                           (height-180  ) + ")")
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight","bold")
        .style("fill", 'red')
        .text("Figure 5 - Label Prevalence");

        //create Legend   
svg.append("rect")
		
		.attr("x",width/2 +52)
		.attr("y",height - 191)
		.attr("width",8)
		.attr("height",8).style("fill","#a6cee3")
svg.append("text")
		.attr("x", width/2 +52)
		.attr("y", height - 178)
		.text("0")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +60)
		.attr("y",height - 191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#1f78b4")
svg.append("text")
		.attr("x", width/2 +63)
		.attr("y", height - 178)
		.text("<=5")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +85)
		.attr("y",height - 191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#b2df8a")
svg.append("text")
		.attr("x", width/2 +87)
		.attr("y", height - 178)
		.text("<=10")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")
svg.append("rect")
		.attr("x",width/2 +110)
		.attr("y",height - 191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#33a02c")
svg.append("text")
		.attr("x",width/2 +112)
		.attr("y", height - 178)
		.text("<=15")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +134)
		.attr("y",height - 191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#fb9a99")
svg.append("text")
		.attr("x", width/2 +139)
		.attr("y", height - 178)
		.text("<=20")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +159)
		.attr("y",height - 191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#e31a1c")
svg.append("text")
		.attr("x", width/2 +163)
		.attr("y", height -178)
		.text("<=25")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +184)
		.attr("y",height -191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#ff7f00")
svg.append("text")
		.attr("x", width/2 +186)
		.attr("y", height -178)
		.text("<=30")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +209)
		.attr("y",height -191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#cab2d6")
svg.append("text")
		.attr("x", width/2 +212)
		.attr("y", height -178)
		.text("<=50")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

svg.append("rect")
		.attr("x",width/2 +233)
		.attr("y",height -191)
		.attr("width",25)
		.attr("height",8)
		.style("fill","#6a3d9a")
svg.append("text")
		.attr("x", width/2 +241)
		.attr("y", height -178)
		.text(">50")
		.style("font-size", "8px")
		.attr("alignment-baseline","middle")

}

//Prevlance of the Label per each month


//***********************************
function showDocBarChart(svgContainerId, data) 

{
	removeChart(svgContainerId);

	var t = d3.transition()
            .duration(1500);

	//var svg = d3.select("#" + svgContainerId).append("svg")
	var docs=["Rad", "Path","Prog","Dis","clinical"]
    
var width = 565;
var height = 300;
var margin = { top: 20, right: 10, bottom: 30, left: 75};

for(var i=0;i<data.length; i++)
    {
    

    if(typeof data[i].Rad == 'undefined') 
    {
   		 data[i].Rad= 0
    }

    if(typeof data[i].Path == 'undefined') 
    {
   		 data[i].Path= 0
    }

    if(typeof data[i].Dis == 'undefined') 
    {
   		 data[i].Dis= 0
    }

    if(typeof data[i].Prog == 'undefined') 
    {
   		 data[i].Prog= 0
    }

    if(typeof data[i].clinical == 'undefined') 
    {
   		 data[i].clinical= 0
    }
 

}

console.log("data New =", data)

var svg = d3.select("#documents")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);
var g = svg.append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


  var tooltip = svg.append("g")
  .attr("class", "tooltip")
  .style("display", "none");
    
tooltip.append("rect")
  .attr("width", 60)
  .attr("height", 15)
  .attr("fill", "lightblue")
  .style("stroke", "lightblue")
     
  .style("opacity", 0.5);

tooltip.append("text")
  .attr("x", 30)
  .attr("dy", "1em")
  .style("text-anchor", "middle")
  .attr("font-size", "10px")
  .attr("font-weight", "bold")
  .style('fill', 'darkblue')

  svg.append("text")
        .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height +30 ) + ")")
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", 'red')
		.style("font-weight", "bold")
        .text("Figure 7 - Document Distribution For Patients in the Cohort");

 svg.append("text")
      .attr("transform",
            "translate(" + (width - 250) + " ," + 
                           (height+50	  ) + ")")
      .style('font-size', "10px")
		.style("text-anchor", "middle")
      	


var x = d3.scaleBand()

  .rangeRound([0, width])
  .padding(0.4)
  .align(0);

var y = d3.scaleLinear()
  .rangeRound([0, height]);

var z = d3.scaleOrdinal()
.range(["steelblue", "#618685", "lightblue", "darkorange", "#c94c4c"]);

//.range(["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3"]);

 // .range(["#717C8B", "#7FDDC3", "#39B3CD", "red", "yellow"]);
var keys = ['Rad', 'Path', 'Prog', 'Dis', 'clinical'];
var stack = d3.stack();
data.forEach(function(d) {
  d.month = +d['month'];
  d.Rad = typeof d.Rad === 'number' ? d.Rad : +d['Rad']
  d.Path = typeof d.Path === 'number' ? d.Path : +d['Path']
  d.Prog = typeof d.Prog === 'number' ? d.Prog : +d['Prog']
  d.Dis = typeof d.Dis === 'number' ? d.Dis : +d['Dis']
  d.clinical = typeof d.clinical === 'number' ? d.clinical : +d['clinical']
  d.total = d.Rad + d.Path + d.Prog+ d.Dis+ d.clinical;
});


x.domain(data.map(function(d) {
  return d.month;
}));
y.domain([0, d3.max(data, function(d) {
  return d.total;

})]).nice();
var keys = ['Rad', 'Path', 'Prog', 'Dis','clinical'];
z.domain(keys);

//console.log(d3.stack().keys(keys)(data))
g.selectAll(".serie")
  .data(d3.stack().keys(keys)(data))
  .enter()

  .append("g")
  .attr("fill", function(d) { return z(d.key); })
  .attr("class", function(d){ return "myRect " + d.key})
  .selectAll("rect")
  .data(function(d) {
    return d;
  })
  .enter().append("rect")
  .attr("x", function(d) {
    return x(d.data.month);
  })
  .attr("y", function(d) {
    return y(d[0]);
  })
  .attr("height", function(d) {
    return y(d[1]) - y(d[0] );
  })
  
  .attr("width", x.bandwidth())
  //.on('mouseover', function(d,i,j) { tip.show(d, docs[docs.length - 1 - j]); })
  //.on('mouseout', tip.hide);


   .on("mouseover", function() { tooltip.style("display", null); })
  .on("mouseout", function() { tooltip.style("display", "none")
  	d3.select(this).style("opacity", 1); })
  .on("mousemove", function(d) {
    var xPosition = d3.mouse(this)[0] - 5;
    var yPosition = d3.mouse(this)[1] - 5;
    var subgroupName = d3.select(this.parentNode).datum().key;
    var subgroupValue = d.data[subgroupName];
    d3.select(this).style("opacity", 0.3)
    tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
  	//tooltip.html("subgroup: " + subgroupName + "<br>" + "Value: " + subgroupValue)
       // .style("opacity", 1)
    tooltip.select("text")
  	.text(subgroupName +  ": " + subgroupValue)//d[1]-d[0] + " " + d3.mouse(this)[keys]) //.text(d3.mouse(this))// + "\n" + "Dis :" + d.data.Dis)//text(d[1]-d[0]);
    	
  });
  



  var text = svg.selectAll(".text")
			.data(data, d => d.month);
			text.exit().remove()

		/*text.enter().append("text")
			.attr("class", "text")
			.attr("text-anchor", "middle")
			.attr("font-size","7px")
			.attr("font-weight","bold")
			
			.attr("x", d => x(d.month) + 65)
			.attr("y", d => y(d.total) )
			.text(d => d.total)*/

g.append("g")
  .attr("class", "axis axis--x")
  //.transition(t)
  .attr("transform", "translate(0," + 0 + ")")
  .attr('x', 0)

  .call(d3.axisTop(x).tickSize(4).ticks(20))
  //.call(d3.axisBottom(x));


var sum=0;
g.append("g")
  .attr("class", "axis axis--y")
 // .transition(t)
  .call(d3.axisLeft(y))
  .append("text")
  .attr("x", 2)
  .attr("y", y(y.ticks(5).pop()))
  .attr("dy", "0.35em")
  .attr("text-anchor", "start")
  .attr("fill", "darkblue")
  .style("font-weight", 'bold')
  .attr("transform", "rotate(-90)")
  .attr("y", -40)
  .attr("x", -80)
  .style("text-anchor", "end")
  .style("fill", 'darkblue')
	.style("font-weight", "bold")
  .text("Document Count Per Type");

var legend = g.selectAll(".legend")
  .data(keys.reverse())
  .enter().append("g")
  .attr("class", "legend")
  .attr('transform', function(d, i) {
    var horz = width - margin.right - (44 * i); // NEW
    var vert = 300;
    return 'translate(' + horz + ',' + vert + ')'; // NEW
  })
  .style("font", "8px sans-serif");

legend.append("rect")
  .attr("x", "0")
  .attr("width", 10)
  .attr("height", 10)
  .attr("fill", z);

legend.append("text")
  .attr("x", "-5")
  .attr("y", 5)
  .attr("dy", ".35em")
  .attr("text-anchor", "end")
  .text(function(d) {
    return d;
  });
  
	
}
	
//*********************************************************************************
//****************** Sankey D3****************************************************
function showEpisode(svgContainerId, data) 
{
	removeChart(svgContainerId);
	console.log(data)

   var margin = {top: 15, right: 10, bottom: 60, left: 10},
    width = 460 - margin.left - margin.right,
    height = 270 - margin.top - margin.bottom;
 //schemeSet1

    color = d3.scaleOrdinal(d3.schemeSet1);

// append the svg canvas to the page
var svg = d3.select("#" + svgContainerId).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("padding", "10px")
  	.append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

    svg.append("text")
		.attr("class", "Sankey_title")
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (0-margin.top)  + ")")
      .style('font-size',"10px")
      .style('fill', 'red')
		.style("text-anchor", "middle")
		.attr("font-weight", "bold")
      	.text("Figure 6 - Overview of Episode Transitions");

   
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
        	showResultsTitle3("results_title",d.patienList , d.target.name,d.source.name,d.value )
        	getEpisodeLabel(d.patienList)

        	}) 
 
// add the link titles
  link.append("title")
        .text(function(d) {
      	return d.source.name.substr(0,d.source.name.indexOf(' ')) + " → " + 
                d.target.name.substr(0,d.target.name.indexOf(' ')) + "\n" +"number of patient : " + d.value; })
    
 
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
      .attr("fill", function(d) { 
		  return d.color = color(d.name.replace(/ .*/, "")); })
      .attr("stroke", function(d) { 
		  return d3.rgb(d.color).darker(0); })
    .append("title")
      .text(function(d) { 
		  return d.name.substr(0,d.name.indexOf(' ')) + "\n" + "Number of Patient: " + d.value; })
      
 

 
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
   var legendRectSize = 5;  
   var legendSpacing = 3;
 var legend = svg.selectAll('.legend1')                     
          .data(color.domain())                                   
          .enter()                                                
          .append('g')                                            
          .attr('class', 'legend1')                                
          .attr('transform', function(d, i) {                     
            var height = legendRectSize + legendSpacing;          
           // var offset =  height * color.domain().length / 2;     
            var horz = 2 * i*legendRectSize;                       
            var vert = height +370  //+ offset;                       
            return 'translate(' + vert   + ',' + (horz + 200) + ')';        
          });                                                     

        legend.append('rect')                                     
          .attr('width', legendRectSize)                          
          .attr('height', legendRectSize) 
                             
          .style('fill', color)                                   
          .style('stroke', color);                                
          
        legend.append('text')                                     
          .attr('x', legendRectSize + legendSpacing )              
          .attr('y', legendRectSize - legendSpacing + 4)              
          .text(function(d) { return d; });                       




      
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
		//showHeatMap1("HeatMap1", response.label);
		//console.log("This is the Label response");
		//console.log(response.label)
		
		//console.log("This is the Episode Response")
		//console.log('response', response.episode);
		showEpisode("sankey", response.episode);
		showDocBarChart("documents", response.doc);
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
		showDocBarChart("documents", response.doc);
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
		showDocBarChart("documents", response.doc);
		
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



