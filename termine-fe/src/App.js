import React, { useEffect, useCallback, useRef, useState } from "react";
import { trackPromise, usePromiseTracker } from "react-promise-tracker";

import { INFOBOX_STATES, ISOStringWithoutTimeZone } from "./utils";
import * as Api from "./Api";
import BookView from "./Views/BookView";
import BookingHistoryView from "./Views/BookingHistoryView";

function App() {
  const useFocus = () => {
    const htmlElRef = useRef(null);
    const setFocus = useCallback(() => {
      htmlElRef.current && htmlElRef.current.focus();
    }, [htmlElRef]);
    return [htmlElRef, setFocus];
  };

  const TAB = {
    BOOK: "book",
    BOOKED: "booked",
  };

  const { promiseInProgress } = usePromiseTracker();

  const [inputRef, setInputFocus] = useFocus();
  const [triggerRefresh, setTriggerRefresh] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState({
    startDateTime: "",
    lengthMin: 0,
  });
  const [bookedAppointment, setBookedAppointment] = useState({
    startDateTime: "",
    lengthMin: 0,
  });
  const [showSpinner, setShowSpinner] = useState(promiseInProgress);
  const [freeSlotList, setFreeSlotList] = useState(null);
  const [coupons, setCoupons] = useState(null);
  const [claimToken, setClaimToken] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [focusOnList, setFocusOnList] = useState(true);
  const [infoboxState, setInfoboxState] = useState({
    state: INFOBOX_STATES.INITIAL,
    msg: "",
  });
  const [formState, setFormState] = useState({
    firstName: "",
    name: "",
    phone: "",
    office: "",
  });
  const [currentTab, setCurrentTab] = useState(TAB.BOOK);
  const [bookedList, setBookedList] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const getSlotListData = useCallback(() => {
    return Api.fetchSlots()
      .then((response) => {
        if (response.status === 200) {
          setFreeSlotList(response.data.slots);
          setCoupons(response.data.coupons);
        }
      })
      .catch((error) => {
        //TODO: error handling
      });
  }, []);

  const getBookedListData = useCallback(() => {
    return Api.fetchBooked(
      ISOStringWithoutTimeZone(startDate),
      ISOStringWithoutTimeZone(endDate)
    )
      .then((response) => {
        if (response.status === 200) {
          setBookedList(response.data);
        }
      })
      .catch((error) => {
        //TODO: error handling
      });
  }, [startDate, endDate]);

  const refreshList = () => setTriggerRefresh(true);

  // use focusOnList as switch between slots table and form
  useEffect(() => {
    if (focusOnList) refreshList();
    else setInputFocus();
  }, [focusOnList, setInputFocus]);

  // use focusOnList as switch between slots table and form
  useEffect(() => {
    if (currentTab === TAB.BOOKED) {
      getBookedListData();
    }
  }, [currentTab, getBookedListData, TAB.BOOKED]);

  // refresh once on triggerRefresh, then every 60 sec
  useEffect(() => {
    let interval = null;

    if (triggerRefresh) trackPromise(getSlotListData());
    setTriggerRefresh(false);

    interval = setInterval(() => {
      trackPromise(getSlotListData());
    }, 60000);

    return () => clearInterval(interval);
  }, [triggerRefresh, getSlotListData]);

  // let the spinner animation run for 1.25 secs
  useEffect(() => {
    let timeout = null;

    if (promiseInProgress) {
      setShowSpinner(true);
    } else if (showSpinner) {
      setTimeout(() => setShowSpinner(false), 1250);
    }

    return () => clearTimeout(timeout);
  }, [showSpinner, promiseInProgress]);

  const claimAppointment = (startDateTime, slotLengthMin) => {
    if (claimToken !== "") {
      Api.unClaimSlot(claimToken).catch((error) => {
        // TODO: error handling?
      });
    }
    return Api.claimSlot(startDateTime)
      .then((response) => {
        setInfoboxState({
          state: INFOBOX_STATES.FORM_INPUT,
          msg: "",
        });
        setStartDateTime(startDateTime);
        setSelectedAppointment({
          startDateTime: startDateTime,
          lengthMin: slotLengthMin,
        });
        setClaimToken(response.data);
        setFormState({
          ...formState,
          firstName: "",
          name: "",
          phone: "",
        });
        setFocusOnList(false);
      })
      .catch((error) => {
        setInfoboxState({
          state: INFOBOX_STATES.ERROR,
          msg:
            error.response.status === 410
              ? "Leider ist der Termin inzwischen nicht mehr buchbar, bitte einen anderen Termin wählen."
              : "Ein unbekannter Fehler ist aufgetreten, bitte Seite neu laden.",
        });
        setStartDateTime("");
        setClaimToken("");
        setFocusOnList(true);
      });
  };

  const onBook = (data) => {
    Api.book(data)
      .then((response) => {
        setInfoboxState({
          state: INFOBOX_STATES.APPOINTMENT_SUCCESS,
          msg: response.data.secret,
        });
        setStartDateTime(response.data.time_slot);
        setBookedAppointment({
          startDateTime: response.data.time_slot,
          lengthMin: response.data.slot_length_min,
        });
        setClaimToken("");
        setFocusOnList(true);
      })
      .catch((error) => {
        setInfoboxState({
          state: INFOBOX_STATES.ERROR,
          msg:
            error.response.status === 410
              ? "Leider ist der Termin inzwischen nicht mehr buchbar, bitte einen anderen Termin wählen."
              : "Ein unbekannter Fehler ist aufgetreten, bitte Seite neu laden.",
        });
        setStartDateTime("");
        setClaimToken("");
        setFocusOnList(true);
      });
  };

  const onCancelBooking = () => {
    Api.unClaimSlot(claimToken)
      .then(() => {
        setInfoboxState({
          state: INFOBOX_STATES.INITIAL,
          msg: "",
        });
        setStartDateTime("");
        setClaimToken("");
        setFocusOnList(true);
        setFormState({
          ...formState,
          firstName: "",
          name: "",
          phone: "",
        });
      })
      .catch((error) => {
        //Todo handle error
        console.error(error);
      });
  };

  const logout = () => {
    Api.logout();
  };

  return (
    <div className="container">
      <header style={{ minHeight: "54px", maxHeight: "6vh" }}>
        <div className="displayFlex">
          <h3 style={{ paddingLeft: "var(--universal-padding)" }}>
            {window.config.longInstanceName}
          </h3>
          <a
            href={"#" + TAB.BOOK}
            className="button"
            onClick={() => setCurrentTab(TAB.BOOK)}
          >
            Termine buchen
          </a>
          <a
            href={"#" + TAB.BOOKED}
            className="button"
            onClick={() => setCurrentTab(TAB.BOOKED)}
          >
            Meine Buchungen
          </a>
          <div className="flexAlignRight">
            <input type="button" value="Logout" onClick={logout} />
          </div>
        </div>
      </header>
      {currentTab === TAB.BOOK &&
        BookView(
          focusOnList,
          freeSlotList,
          coupons,
          claimAppointment,
          setSelectedAppointment,
          selectedAppointment,
          showSpinner,
          refreshList,
          infoboxState,
          bookedAppointment,
          onBook,
          onCancelBooking,
          claimToken,
          startDateTime,
          formState,
          setFormState,
          inputRef
        )}
      {currentTab === TAB.BOOKED &&
        BookingHistoryView(
          bookedList,
          startDate,
          setStartDate,
          endDate,
          setEndDate
        )}
    </div>
  );
}

export default App;
