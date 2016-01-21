go.app = function() {
    var vumigo = require('vumigo_v02');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;
    var FreeText = vumigo.states.FreeText;
    var JsonApi = vumigo.http.api.JsonApi;
    var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
    var _ = require("lodash");

    var GoApp = App.extend(function(self) {
        App.call(self, 'states:start');

        self.init = function() {            
            self.http = new JsonApi(self.im);       
        };
        
        self.states.add('states:start', function(name) {
            return new ChoiceState(name, {
                question: 'Welcome to Wazimap! What would you like to do?',
        
                choices: [
                    new Choice('states:location', 'Enter a location to query'),
                    new Choice ('states:randomLocation', 'Query a random location'),
                    new Choice('states:end', 'Exit')],

                next: function(choice) {
                   return choice.value;
                }
            });
        });

        self.states.add('states:location', function(name) {
            return new FreeText(name, {
                question: 'Please enter a location on National, Provincial or Ward level to query:',
                next: function(content) {
                    return self 
                    .http.get('http://wazimap.co.za/place-search/json/', {
                        params: {q : content}
                    })
                    .then (function(response) {  
                        return {
                            name: 'states:results',
                            creator_opts: {
                                locations: response.data.results
                            } 
                        };
                    }); 
                }   
            });
        });

        self.states.add('states:results', function(name, opts) {
            var location_choices = _.map(opts.locations.slice(0,2), function(d) {
                return new Choice(d.full_geoid, d.full_name);
            });

            return new PaginatedChoiceState(name, {
                question: 'Please select the location you would like to query:',
                choices: location_choices,
                characters_per_page: 160,
                options_per_page : 2,
                next: function(choice) {
                    return { 
                        name: 'states:retrieve-location',
                        creator_opts : {
                            full_geoid : choice.value,
                            full_name : choice.label
                        }
                    };
                }   
            });
        });

        self.states.add('states:retrieve-location', function(name, opts) {
            return self
                .http.get('http://wazimap.co.za/profiles/' + opts.full_geoid + '.json')
                .then(function(response) {
                    opts.data = response.data;
                    return  self.states.create(
                        'states:select-section', opts);
                });
        });

        self.states.add('states:select-section', function(name, opts) {
            return new ChoiceState(name, {
                question: 'I would like to query:',
                choices: [
                    new Choice('elections', 'Elections'),
                    new Choice('demographics', 'Demographics'),
                    new Choice('households', 'Households'),
                    new Choice('service_delivery', 'Service Delivery'),
                    new Choice('economics', 'Economics'),
                    new Choice('education', 'Education'),
                    new Choice('children', 'Children'),
                    new Choice('child_households', 'Child-headed Households')
                        ],
                next: function(choice) {
                    return {
                        name: 'states:display-data',
                        creator_opts : {
                            section_name : choice.label,
                            section_id : choice.value,
                            opts_data : opts.data,
                            location_name : opts.full_name,
                            location_id : opts.full_geoid
                        }
                    };
                }
            });
        });


    function sub_section(data, section_id) {
        return sub_section[section_id](data);
    }

    sub_section.elections = function(data) {
        //I need to loop through the party distribution to return the top 3 parties
        // votes_results = function(data) {
        //     var first; 
        //     var second; 
        //     var third;
        //     while (data.provincial_2014.party_distribution) {
        //         for ()

        //     }
        // }
        return data.provincial_2014.name + ":\n" + "Registered voters = " + data.provincial_2014.registered_voters.values.this + "\n" + data.provincial_2014.average_turnout.values.this + "% cast their vote";
    };

    sub_section.demographics = function(data) {
        return "RSA Citizens: " + data.citizenship_south_african.values.this + "%\n" + "Most spoken language: " + data.language_most_spoken.name;
    };

        sub_section.households = function(data) {
        return "Informal Dwellings: " + data.informal.values.this + "%\n" + "Homes owned and paid off: " + data.tenure_distribution["Owned and fully paid off"].values.this + "%" ;
    };

        sub_section.service_delivery = function(data) {
        return data.electricity_access_distribution.total_no_elec.name + ": " + data.electricity_access_distribution.total_no_elec.values.this + "%\n" + "Electricity: " + data.electricity_access_distribution.total_all_elec.values.this + "%\n" + "No toilet access: " + data.percentage_no_toilet_access.values.this + "%\n" + "Water from service provider: " + data.percentage_water_from_service_provider.values.this + "%";
    };

        sub_section.economics = function(data) {
        return;
    };

    sub_section.education = function(data) {
        return data.name;
    };

        sub_section.children = function(data) {
        return;
    };

        sub_section.child_households = function(data) {
        return;
    };





        self.states.add('states:display-data', function(name, opts) {
            var section_data = opts.opts_data[opts.section_id]; 
            var return_text = sub_section(section_data, opts.section_id);

            return new PaginatedChoiceState(name, {
                question: [
                opts.location_id,
                opts.section_name + ':',
                return_text
                ].join('\n'),

                characters_per_page : 160,
                options_per_page : 10,

                choices: [
                    new Choice('states:sms', 'SMS details'),
                    new Choice('states:select-section', 'Query another section'),
                    new Choice('states:end', 'Exit')],

                next: function(choice) {
                    if (choice.value == 'states:start' || choice.value == 'states:end') {
                        return choice.value;
                    } else {
                        return {
                            name: choice.value,
                            creator_opts: {
                                section_id : opts.section_id,
                                section_data : section_data
                            }
                        };
                    }
                }
            });
        });

        self.states.add('states:sms', function(name, opts) {
            return new EndState(name, {
                text: 'Sms coming soon!'
            });
        });

        self.states.add('states:randomLocation', function(name) {
            return new EndState(name, {
                text: 'Random locations coming soon!'
            });
        });

        self.states.add('states:end', function(name) {
            return new EndState(name, {
                text: 'Thank you for using Wazimap! Find more information on www.wazimap.co.za',
                next: 'states:start'
            });
        });
    });

    return {
        GoApp: GoApp
    };


}();
