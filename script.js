'use strict';

const form = document.querySelector('.form');
const currentLocBtn = document.querySelector('.localization-btn');
const seeAllBtn = document.querySelector('.maximize-btn');
const sortBtn = document.querySelector('.sort-items-btn');
const deleteAllItemsBtn = document.querySelector('.delall-btn');
const sortbyMenu = document.querySelector('.sortby');
const containerMainEdits = document.querySelector('.main-edits');
const containerWorkouts = document.querySelector('.workouts');
const workoutsBox = containerWorkouts.querySelector('.workouts__box');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const formErrorText = form.querySelector('.form__error');

// EDIT-BOX
const editBox = document.querySelector('.edit-box');
const editForm = editBox.querySelector('.form--edit');
const editBtnCancel = document.querySelector('.form__btn--cancel');
const editBtnOk = document.querySelector('.form__btn--ok');
let editInputType = document.querySelector('.edit__input--type');
let editInputDistance = document.querySelector('.edit__input--distance');
let editInputDuration = document.querySelector('.edit__input--duration');
let editInputCadence = document.querySelector('.edit__input--cadence');
let editInputElevation = document.querySelector('.edit__input--elevation');
const editErrorText = editForm.querySelector('.form__error');
let boxTitle = editBox.querySelector('.edited-title');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.type = 'running';
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

////////////////////////////////////
// APLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #editedWorkout;
  #isEdited = false;

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    // listeners
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    editInputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._clickCheck.bind(this));
    containerMainEdits.addEventListener(
      'click',
      this._mainEditCheck.bind(this)
    );
    sortbyMenu.addEventListener('click', e => {
      this._Sorting(e);
    });
    editBtnCancel.addEventListener('click', e => {
      e.preventDefault();
      editBox.classList.add('edit-box--hidden');
      editErrorText.classList.add('form__error--hidden');
      this.#isEdited = false;
    });
    editForm.addEventListener('submit', this._newWorkout.bind(this));
  }

  _clickCheck(e) {
    const clickedElem = e.target;
    const workout = e.target.closest('li');
    if (clickedElem.classList.contains('delete-item')) {
      this._deleteItem(workout);
      return;
    }
    if (clickedElem.classList.contains('edit-item')) {
      // this.#editedWorkout = clickedElem;
      this._editItem.call(this, e);
      return;
    }
    this._moveToPopup(e);
  }

  _mainEditCheck(e) {
    const clickedElem = e.target;
    // HERE BTN
    if (clickedElem.classList.contains('localization-btn')) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          this._setCurrentPosition.bind(this)
        );
      }
      return;
    }

    // SEE ALL MARKERS BTN
    if (clickedElem.classList.contains('maximize-btn')) {
      if (this.#markers) {
        const group = new L.featureGroup(this.#markers);
        this.#map.fitBounds(group.getBounds());
      }
      return;
    }

    // SORT BTN
    if (clickedElem.classList.contains('sort-items-btn')) {
      if (!localStorage.getItem('workouts') || this.#workouts.length === 1)
        return;
      sortbyMenu.classList.toggle('sortby--hidden');
      return;
    }

    // DELETE ALL BTN
    if (clickedElem.classList.contains('delall-btn')) {
      if (!localStorage.getItem('workouts')) return;
      this.reset();
      return;
    }
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          console.log('cant take location');
        }
      );
    }
  }

  _loadMap(position) {
    // map initialization
    this.#map = L.map('map');

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // create pins on map where local storage items
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    // set current position by page load
    this._setCurrentPosition(position);
  }

  _setCurrentPosition(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map.setView(coords, this.#mapZoomLevel);
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputType.value = 'running';
    inputElevation.closest('.form__row').classList.add('form__row--hidden');
    inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    inputDistance.focus();
    formErrorText.classList.add('form__error--hidden');
  }

  _hideForm() {
    // empty inputs
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField(e) {
    if (e.target.classList.contains('edit__input--type')) {
      editInputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
      editInputCadence
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
      return;
    }
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // BRAND NEW WORKOUT AND NEW FROM EDITION
  _newWorkout(e) {
    e.preventDefault();

    // helper functions
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    let type, distance, duration, lat, lng;

    // get data
    if (this.#isEdited === true) {
      // get data from edit window
      type = editInputType.value;
      distance = +editInputDistance.value;
      duration = +editInputDuration.value;
      lat = this.#editedWorkout.coords[0];
      lng = this.#editedWorkout.coords[1];
    } else {
      // get data from form
      type = inputType.value;
      distance = +inputDistance.value;
      duration = +inputDuration.value;
      lat = this.#mapEvent.latlng.lat;
      lng = this.#mapEvent.latlng.lng;
    }
    let workout;

    // check if data is valid
    if (type === 'running') {
      let cadence = +inputCadence.value;
      if (this.#editedWorkout) cadence = +editInputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._displayErrorText();
        return;
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      let elevation = +inputElevation.value;
      if (this.#editedWorkout) elevation = +editInputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._displayErrorText();
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);

    // render workout on list
    this._renderWorkout(workout);

    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    // hide form + clear input fields
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();

    // delete old workout when editing
    if (this.#isEdited === true) {
      const itemToDel = document.querySelector(
        `[data-id="${this.#editedWorkout.id}"]`
      );
      this._deleteItem(itemToDel);
      this.#isEdited = false;
      editBox.classList.add('edit-box--hidden');
    }
  }

  _displayErrorText() {
    if (this.#isEdited) {
      editErrorText.classList.remove('form__error--hidden');
      return;
    }
    if (!this.#isEdited) {
      formErrorText.classList.remove('form__error--hidden');
      return;
    }
  }

  _renderWorkoutMarker(workout) {
    // remove empty slots from array
    this.#markers = this.#markers.filter(n => n);

    // index for creation new marker
    let i = this.#markers.length;

    this.#markers[i] = new L.Marker([workout.coords[0], workout.coords[1]], {
      draggable: true,
    });
    this.#map.addLayer(this.#markers[i]);
    this.#markers[i]
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup().objId = workout.id;
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <h2 class="workout__title">${workout.description}</h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;
    if (workout.type === 'running')
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">m</span>
    </div>
    
    `;

    if (workout.type === 'cycling')
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
    `;

    html += `
    <div class="workout__edits">
    <span class="workout__icon"><img src="./edit-3.svg" alt="" class="edit-item"></span>
    <span class="workout__icon"><img src="./trash.svg" alt="" class="delete-item"></span>
    </div>
    </li>
    `;

    // form.insertAdjacentHTML('afterend', html);
    workoutsBox.insertAdjacentHTML('afterbegin', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    // if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      work.type === 'running'
        ? Object.setPrototypeOf(work, Running.prototype)
        : Object.setPrototypeOf(work, Cycling.prototype);

      this._renderWorkout(work);
    });
  }

  _updateLocalStorage(elem) {
    // fetch data from local storage
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    // find object to delete from fetched local storage data
    let elemToDel = data.find(el => el.id === elem.dataset.id);

    // remove outdated array
    localStorage.removeItem('workouts');

    // deleting
    data.splice(elemToDel, 1);

    // setting current data into local storage
    localStorage.setItem('workouts', JSON.stringify(data));
  }

  _deleteItem(elem) {
    // define obj to del
    const objToDel = this.#workouts.find(el => el.id === elem.dataset.id);

    // remove empty slots from array
    this.#markers = this.#markers.filter(n => n);

    // define marker from array (#markers) to del
    const markerToDel = this.#markers.find(el => el.objId === objToDel.id);

    // remove layer from map
    const layerOnMapToDel = markerToDel._leaflet_id;
    this.#map.removeLayer(this.#map._layers[layerOnMapToDel]);

    // reduce array with markers(layers)
    this.#markers.splice(this.#markers.indexOf(markerToDel), 1);

    // clear dates and local storage when no workouts
    if (this.#workouts.length <= 1) this.reset();

    // remove workout obj
    this.#workouts.splice(this.#workouts.indexOf(objToDel), 1);

    // update LS
    this._updateLocalStorage(elem);

    // del elem from html
    workoutsBox.removeChild(elem);
  }

  // only sets edited item values into edit box
  _editItem(e) {
    this.#isEdited = true;
    editErrorText.classList.add('form__error--hidden');
    let item = e.target.closest('li');
    let workoutObj = this.#workouts.find(el => el.id === item.dataset.id);
    this.#editedWorkout = workoutObj;

    // edit box title of item
    let itemTitle = item.children[0].textContent;
    boxTitle.textContent = itemTitle;

    // type
    let type = item.classList[1].slice(9);
    type === 'running'
      ? (editInputType.value = 'running')
      : (editInputType.value = 'cycling');

    editInputDistance.value =
      editInputDuration.value =
      editInputCadence.value =
      editInputElevation.value =
        '';

    // setting wheter elev / cadence input should be displayed
    if (type === 'running') {
      editInputElevation
        .closest('.form__row')
        .classList.add('form__row--hidden');
      editInputCadence
        .closest('.form__row')
        .classList.remove('form__row--hidden');
    } else {
      editInputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      editInputCadence.closest('.form__row').classList.add('form__row--hidden');
    }

    // listener
    // in time changing edit box title of item
    editInputType.addEventListener('change', () => {
      let activity =
        editInputType.value.charAt(0).toUpperCase() +
        editInputType.value.slice(1);
      let rest = boxTitle.textContent.slice(8);

      boxTitle.textContent = `${activity} ${rest}`;
    });

    // edit window visible
    editBox.classList.remove('edit-box--hidden');
    editInputDistance.focus();
  }

  _Sorting(e) {
    workoutsBox.innerHTML = '';

    // choose sorting way
    let way = e.target.dataset.sortway;

    // shallow copy of all aobjects
    this.activities = this.#workouts.slice();

    // in order to sort by speed: to obj 'cycling' added property speed
    this.activities.forEach(function (act) {
      if (act.type === 'running') {
        act.speed = act.pace;
      }
    });

    // sorting
    this.activities.sort((a, b) => {
      return a[way] - b[way];
    });

    // display items of sorted array
    this.activities.forEach(act => {
      this._renderWorkout(act);
    });

    sortbyMenu.classList.add('sortby--hidden');
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}
const app = new App();
