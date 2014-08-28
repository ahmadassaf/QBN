console.log("====== QBN STARTED LISTENING TO QUORA NOTIFICATIONS ====== ");


var required_scripts = ["underscore"];
var injection_scripts = [];
// This function will inject the required Scripts into the main notifications page
$(required_scripts).each(function() {
	var script = this;
	injection_scripts[this] = document.createElement('script');
	injection_scripts[this].src = chrome.extension.getURL('lib/' + script + '.js');
	injection_scripts[this].onload = function() {  this.parentNode.removeChild(this); };
	(document.head||document.documentElement).appendChild(injection_scripts[this]);
});

// To Successfully Intercept AJAX calls, we had to embed the script directly in the Notifications page
var injectedCode = '(' + function() {
	if (!window.QBN) window.QBN = {};
	jQuery.extend(window.QBN,{
	// Cluster the Quora notifications
	updateNotificationsList: function() {
		$(window.QBN.quora_selectors.notifications_container + ' li.unseen').each(function() {
			if (!$(this).hasClass('UNSEEN'))
				$(this).addClass('UNREAD').find('.notification').append('<span class="qbn_notification_unread"></span>');
		});
		// Build the selectors array that we will loop on
		$.each(window.QBN.parserMappings, function(key, value) {
			// Build the selector that will be used to grab the asscoiated notification
			var notifications_selector = $(window.QBN.notifications_to_parse + ":contains('" + value + "')").addClass('notifications_' + key);
			// Check if there are any notifications found
			if (notifications_selector.length > 0 ) {

				var notification_coutner  = notifications_selector.length;
				var notification_id       = 'notifications_' + key;
				// Check if the new filters list has been built at least once, if yes refresh only the counter
				if ($('#' + notification_id).length > 0  ) {
					$('#' + notification_id + ' .unread_count').text(notification_coutner);
				} else {
					// The counter item for this notification type has not been built yet ... do it !!
					var new_notification_list = '<li class="tab linked_list_item QBN_notification"><a class="qbn_filter link" id="'+ notification_id +'">' + key.replace('_',' ') +
					'<span class="unread_count">'+ notification_coutner +'</span></a></li>';
					// Add the filter as a class that will be used to filter notifications
					$(notifications_selector).addClass(notification_id);
					// Append the notification counter to the currently styled Quora list
					$(window.QBN.quora_selectors.notifications_list).append(new_notification_list);
				}
			}
		});
	},
	attachActions: function() {
		// Attach notifications filter actions
		$(window.QBN.quora_selectors.header).on('click', '.qbn_filter', function(e) {
			e.preventDefault();
			// Toggle the active filter class, the id of the active class will be used for clustering the notifications
			$(this).toggleClass('active');
			$('.qbn_filter').not('#' + $(this).attr('id')).removeClass('active');
			// Check if ther active class has been toggled and filter the notifications based on the active ID
			window.QBN.filterNotifications($('.qbn_filter.active').attr('id'));
		});
		// Attach topic filtering actions
		$('#topicsFilter').change(function() {
			$('.pagedlist_item').hide();
			$('.'+ $('option.option_filter:selected').val()).parents('.pagedlist_item').show();
		});
		// Attach notifications filter actions
		$('.notifications_tab').on('click', '.qbn_notification_unread', function(e) {
			var URL = $(this).parents(window.QBN.quora_selectors.notification_item).find('a[action="notificationSelected:"]').first().attr('href');
			$.ajax({ url: URL });
		});
	},
	buildFiltersDropdown: function() {
		var topics_array    = _.unique(window.QBN.questions_topics);
		$('option.option_filter:selected').val() == '*' ?  $('.pagedlist_item').show(): $('.' + window.QBN.hashCode($('option.option_filter:selected').val() + '' )).parents('.pagedlist_item').show()
		if ($('option.option_filter').length > 1 && $('option.option_filter').length !== window.QBN.questions_topics.length) {
			// Dropdownbox already built, update new items
			var last_added_item = _.indexOf(topics_array, $('option.option_filter').last().val());
			var new_items       =  topics_array.slice(++last_added_item, topics_array.length);
			if (new_items.length > 0 )
				buildFilters(new_items)
		} else {
			buildFilters(topics_array);
		}
		function buildFilters(filtersArray) {
			// build the topic filtering dropdown box
			if (filtersArray.length > $('#topicsFilter option').length ) {
				var topics_string = '';
				$(filtersArray).each(function() {
					topics_string +='<option class="option_filter" value="' + this + '">' + this.replace('_',' '); + '</option>';
				});
				$('#topicsFilter').append(topics_string);
			}
		}
	},
	filterNotifications: function(id) {
		if (id) {
			$(window.QBN.notifications_to_parse).not('.' + id).hide();
		} else $(window.QBN.notifications_to_parse).show();
	},
	clusterNotifications: function() {
		$.each(window.QBN.parserMappings, function(key, value) {
			var notification_id   = 'notifications_' + key;
			switch (key) {
				case "answers"  : window.QBN.clusterAnswers(notification_id); break;
				case "questions": window.QBN.clusterQuestions(notification_id); break;
			}
		});
	},
	clusterAnswers: function(notification_id) {
		$('li.' + notification_id + ':not(.QBN_PARSED)').each(function()
		{
			// Add a parsed notification to bypass parsing a node that has been already parsed
			$(this).addClass('QBN_PARSED');
			// Catch New Answers Notifications and Cluster them based on common question
			var notification  = this;
			var question_ID   = $(this).find('span:first').attr('id');
			var question_user = $(this).find('.user').text();
			var question_node = $(this).find('a[action="notificationSelected:"]');
			var context_node  = $(question_node).find('.question_context span').first();
			var context       = $(context_node).text();
			var question      = $(question_node).text();
			var question_hash = window.QBN.hashCode(question + '');

			if (_.has(window.QBN.new_answers_notification, question_hash)) {
				window.QBN.new_answers_notification[question_hash].node.push(question_node);

				var id      = window.QBN.new_answers_notification[question_hash].question_ID;
				var counter = window.QBN.new_answers_notification[question_hash].node.length;

				// check if the new counter has been added and only update the counter
				if (window.QBN.new_answers_notification[question_hash].user !== "")
					$('#' + id + ' .user').hasClass('QBN_counter_active') ? $('#' + id + ' .user .qbn_counter').text(counter) : $('#' + id + ' .user').html(window.QBN.new_answers_notification[question_hash].user + " and <span class='qbn_counter'>" + counter + '</span> others ').addClass('QBN_counter_active');
				else
					$('#' + id).hasClass('QBN_counter_active') ? $('#' + id).find('.qbn_counter').text(counter) : $('#' + id).html($('#' + id).html().replace('Anonymous', 'Anonymous and <span class="qbn_counter">' + counter + '</span> others ' )).addClass('QBN_counter_active');
				// Add Clustered keyword to support identification of clustered answers
				if ($('#' + id).parents('.pagedlist_item').find('.qbn_notification').length == 0) $('#' + id).parents('.notification_item ').append('<span class="qbn_notification"></span>');
				// Remove/Hide the current answer that is found as a duplicate
				$('#' + question_ID).parents('.pagedlist_item').addClass('hidden_notification');
			} else window.QBN.new_answers_notification[question_hash] = {
						"node"       : [question_node],
						"user"       : question_user,
						"text"       : question,
						"question_ID": question_ID,
						"context"    : context
				};
		});
	},
	clusterQuestions: function(notification_id) {
		$('li.' + notification_id + ':not(.QBN_PARSED)').each(function(){
			// Add a parsed notification to bypass parsing a node that has been already parsed
			$(this).addClass('QBN_PARSED');

			var question_topics = [];
			var notification    = this;
			var question_ID     = $(this).find('span:first').attr('id');
			var entities        = $(this).find('a[action="notificationSelected:"]');
			var question_node   = $(entities).first();
			var question        = $(question_node).text();
			var question_hash   = window.QBN.hashCode(question + '');

			var context_node    = $(question_node).find('.question_context span').first();
			var context_ID      = $(context_node).attr('id');
			var context         = $(context_node).text().replace(' ','_');

			var topic_node      = $(entities).last();
			var topic           = $(topic_node).text().replace(' ','_');
			var topic_ID        = $(topic_node).find('span').attr('id');

			// Gather the context and topic information from the post and attach it to the question for filtering
			context !== "" ? question_topics.push(context, topic) : question_topics.push(topic);
			// Add the topic and context information to the global filtering array
			context !== "" ? window.QBN.questions_topics.push(context, topic) : window.QBN.questions_topics.push(topic);
			// Add the topics and contexts found as data attributes and classes for the question (used for filtering)
			$('#' + question_ID).attr('data-topic',question_topics.join(" ")).addClass(question_topics.join(" "));

			if (_.has(window.QBN.new_questions_notification, question_hash)) {
				// Add the new topics found in the new question with those from the previously attached questions
				window.QBN.new_questions_notification[question_hash].topic = _.union(window.QBN.new_questions_notification[question_hash].topic, question_topics);
				var id               = window.QBN.new_questions_notification[question_hash].topic_ID;
				var topic            = window.QBN.new_questions_notification[question_hash].topic;
				var context          = window.QBN.new_questions_notification[question_hash].context;
				var main_question_ID = window.QBN.new_questions_notification[question_hash].question_ID;
				// Remove/Hide the current question that is found as a duplicate
				$('#' + question_ID).parents('.pagedlist_item').addClass('hidden_notification');
				// Add the topics and contexts found as data attributes and classes for the first question (used for filtering)
				$('#' + main_question_ID).attr('data-topic',topic.join(" ")).addClass(topic.join(" "));
				// Change the Question text to reflect cluster information
				if (context !== "") $('#' + main_question_ID).parents(window.QBN.quora_selectors.notification_item).find('.question_context').remove();
				if ( topic.length > $('#' + id + ' .qbn_counter').text() ) {
					$('#' + id).empty().html( ': <span class="qbn_counter">' + topic.length + '</span> topics ( ' + topic.join(", ").replace(/_/g,' ') + ' )');
				}
				// Add Clustered keyword to support identification of clustered questions
				if ($('#' + main_question_ID).parents(window.QBN.quora_selectors.notification_item).find('.qbn_notification').length == 0) $('#' + main_question_ID).parents('.notification_item ').append('<span class="qbn_notification"></span>');
			} else {
				window.QBN.new_questions_notification[question_hash] = {
					"question_ID": question_ID,
					"topic_ID"   : topic_ID,
					"context_ID" : context_ID,
					"context"    : context,
					"text"       : question,
					"topic"      : _.unique(question_topics)
				}
			};
		});
	}
});

console.log("Building the Quora Better Notifications Panel ... ");

/* List all the possible actions that can occur on a Quora Notifications List */

	window.QBN.include_all_notifications  = true;
	window.QBN.new_answers_notification   = [];
	window.QBN.new_questions_notification = [];
	window.QBN.questions_topics           = [];
	window.QBN.quora_selectors            = {
		'header'                 : '.NotificationsNav',
		'notifications_list'     : '.QBN_categories .list_contents',
		'notifications_container': 'ul.NotificationsList',
		'notification_item'      : '.notification_item',
	}

window.QBN.parserMappings = {
		questions         : "was added",								                     // new question added to a topic you follow
		replies           : "replied to your",							                 // replies to a some action you posted
		post_comments     : "commented on your post",					               // comments on one of your posts
		answer_comments   : "commented on your answer",					             // comments on one of your answers
		suggestions       : "suggested edits",							                 // suggested edit to question
		seeks             : "asked you to answer",						               // asked you to answer a question
		mentions          : "mentioned you in",							                 // mentioned you in a post
		answers           : "wrote an answer for the question",			         // wrote an answer for a question you follow
		promotes          : "promoted your",							                   // promoted a question you asked
		blog_followers    : "now following your blog",					             // you have a new follower to one fo your blogs
		question_followers: "now following a question you added",		         // you have a new follower to one of your questions
		followers         : "now following you.",						                 // you have a new user following you
		upvotes           : "voted up",									                     // voted up an answer for you on some question
		thanks            : "thanked you for",							                 // thanked you for an answer or contribution
		tweets            : "posted a Tweet",							                   // Tweeted about some of your content
		bio               : "suggested you describe your experience"	       // Suggested to edit your bio
	};

window.QBN.hashCode = function(string) {
  var hash = 0, i, chr, len;
  if (string.length == 0) return hash;
  for (i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

		// Check if the user has selected to group all notifications or only the unread ones
		window.QBN.notifications_to_parse    = window.QBN.quora_selectors.notifications_container;
		window.QBN.notifications_to_parse   += window.QBN.include_all_notifications ? ' li' : ' li.unseen';
		// Insert the topic filtering notification in the sidebar
		$(window.QBN.quora_selectors.header).append('<div class="QBN_categories"><div class="SimpleTabs Tabs simple_tabs"><ul class="list_contents" ><li class="title">Filter By Type++</li></ul></div>');
		$(window.QBN.quora_selectors.header).append('<div class="SimpleTabs Tabs simple_tabs"><ul class="list_contents" ><li class="title">Filter By Topic</li></ul>');
		// Insert the filtering dropdown menu that will be populated with discovered topics
		$(window.QBN.quora_selectors.header).append('<span class="topics_filter"><select id="topicsFilter"><option class="option_filter" value="*">Show All</option></select></span>');
		// Attach the action items for filtering on topics and notification types
		window.QBN.attachActions();
		$('body').ajaxSuccess(function(evt, request, settings){
			if (evt.delegateTarget.baseURI == 'http://www.quora.com/notifications') {
				window.QBN.updateNotificationsList();
				window.QBN.filterNotifications($('.qbn_filter.active').attr('id'));
				window.QBN.clusterNotifications();
				window.QBN.buildFiltersDropdown();
			}
		});
	} + ')();';

// Inserting the script into the page
var script         = document.createElement('script');
script.textContent = injectedCode;
(document.head||document.documentElement).appendChild(script);
script.parentNode.removeChild(script);




