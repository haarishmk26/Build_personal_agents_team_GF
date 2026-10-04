alter table agentmail_message drop constraint if exists agentmail_message_pkey;
alter table agentmail_message add primary key (message_id, user_id);