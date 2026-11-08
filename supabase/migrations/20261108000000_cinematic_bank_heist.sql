create or replace function public.crime_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_state public.player_crime_states%rowtype;
  v_wallet_result jsonb;
  v_balance bigint;
  v_version bigint;
  v_loot bigint := 0;
  v_outcome text;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_action is null or p_action not in (
    'bank_rob', 'bank_rob_escape', 'bank_rob_complete', 'bank_hack',
    'church_offering', 'bail', 'court_wait', 'court_lawyer', 'court_defend'
  ) then
    raise exception 'unknown_action';
  end if;

  perform public.ensure_wallet(v_uid);
  insert into public.player_crime_states (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_state
  from public.player_crime_states
  where user_id = v_uid
  for update;

  case p_action
    when 'bank_rob' then
      if v_state.case_status <> 'clear' then raise exception 'case_pending'; end if;

      if random() < 0.4 then
        v_state.case_status := case
          when v_state.stolen_amount < 100000 then 'station'
          else 'court'
        end;
        v_state.arrest_reason := 'bank_theft';
        v_outcome := 'arrested';
      else
        v_loot := floor(random() * 125001)::bigint + 25000;
        v_wallet_result := public.wallet_apply(v_uid, v_loot, 'bank_theft', 'bank');
        v_state.stolen_amount := v_state.stolen_amount + v_loot;
        v_outcome := 'loot';
      end if;

    when 'bank_rob_escape' then
      if v_state.case_status <> 'clear' then raise exception 'case_pending'; end if;

      if random() < 0.25 then
        v_state.case_status := 'station';
        v_state.arrest_reason := 'bank_theft';
        v_outcome := 'arrested';
      else
        v_loot := floor(random() * 25001)::bigint + 25000;
        v_wallet_result := public.wallet_apply(v_uid, v_loot, 'bank_theft', 'bank');
        v_state.stolen_amount := v_state.stolen_amount + v_loot;
        v_outcome := 'loot';
      end if;

    when 'bank_rob_complete' then
      if v_state.case_status <> 'clear' then raise exception 'case_pending'; end if;

      v_loot := floor(random() * 125001)::bigint + 125000;
      v_wallet_result := public.wallet_apply(v_uid, v_loot, 'bank_theft', 'bank');
      v_state.stolen_amount := v_state.stolen_amount + v_loot;
      v_state.case_status := 'station';
      v_state.arrest_reason := 'bank_theft';
      v_outcome := 'arrested';

    when 'bank_hack' then
      if v_state.case_status <> 'clear' then raise exception 'case_pending'; end if;
      v_state.case_status := 'court';
      v_state.arrest_reason := 'bank_hack';
      v_outcome := 'arrested';

    when 'church_offering' then
      if v_state.case_status <> 'clear' then raise exception 'case_pending'; end if;
      if v_state.church_offering_claimed then raise exception 'offering_taken'; end if;
      v_wallet_result := public.wallet_apply(v_uid, 50000, 'church_offering', 'church');
      v_state.church_offering_claimed := true;
      v_outcome := 'offering';

    when 'bail' then
      if v_state.case_status <> 'station' then raise exception 'not_at_station'; end if;
      v_wallet_result := public.wallet_apply(v_uid, -150000, 'bank_bail', 'state-cid');
      v_state.case_status := 'clear';
      v_state.stolen_amount := 0;
      v_state.arrest_reason := null;
      v_outcome := 'released';

    when 'court_wait' then
      if v_state.case_status <> 'station' then raise exception 'not_at_station'; end if;
      v_state.case_status := 'court';
      v_outcome := 'state';

    when 'court_lawyer' then
      if v_state.case_status <> 'court' then raise exception 'not_at_court'; end if;
      v_wallet_result := public.wallet_apply(v_uid, -120000, 'court_lawyer', 'federal-high-court');
      v_state.case_status := 'clear';
      v_state.stolen_amount := 0;
      v_state.arrest_reason := null;
      v_outcome := 'released';

    when 'court_defend' then
      if v_state.case_status <> 'court' then raise exception 'not_at_court'; end if;
      if random() < 0.5 then
        v_state.case_status := 'clear';
        v_state.stolen_amount := 0;
        v_state.arrest_reason := null;
        v_outcome := 'released';
      else
        v_state.case_status := 'station';
        v_outcome := 'arrested';
      end if;
  end case;

  v_state.updated_at := now();
  update public.player_crime_states
  set case_status = v_state.case_status,
      stolen_amount = v_state.stolen_amount,
      arrest_reason = v_state.arrest_reason,
      church_offering_claimed = v_state.church_offering_claimed,
      updated_at = v_state.updated_at
  where user_id = v_uid;

  if v_wallet_result is not null then
    v_balance := (v_wallet_result ->> 'balance')::bigint;
    v_version := (v_wallet_result ->> 'version')::bigint;
  else
    select balance, version into v_balance, v_version
    from public.wallets
    where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'status', v_state.case_status,
    'stolenAmount', v_state.stolen_amount,
    'arrestReason', v_state.arrest_reason,
    'offeringClaimed', v_state.church_offering_claimed,
    'balance', v_balance,
    'version', v_version,
    'outcome', v_outcome,
    'loot', v_loot
  );
end;
$function$;

revoke all on function public.crime_action(text) from public, anon;
grant execute on function public.crime_action(text) to authenticated;
