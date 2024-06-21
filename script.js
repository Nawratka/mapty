'use strict';

const form = document.querySelector('.form');
const deleteAllItemsBtn = document.querySelector('.delall-btn');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
///edit///////////////////
// EDIT-BOX
const editBox = document.querySelector('.edit-box');
const editBtnCancel = document.querySelector('.form__btn--cancel');
const editBtnOk = document.querySelector('.form__btn--ok');
let editInputType = document.querySelector('.edit__input--type');
let editInputDistance = document.querySelector('.edit__input--distance');
let editInputDuration = document.querySelector('.edit__input--duration');
let editInputCadence = document.querySelector('.edit__input--cadence');
let editInputElevation = document.querySelector('.edit__input--elevation');
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
  #i = 0;
  #editedWorkout;

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);
    editInputType.addEventListener('change', this._toggleElevationField);
    // containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._clickCheck.bind(this));
    deleteAllItemsBtn.addEventListener('click', this.reset);
    editBtnCancel.addEventListener('click', e => {
      e.preventDefault();
      editBox.classList.add('edit-box--hidden');
    });
    editBtnOk.addEventListener('click', e => {
      // set new item from edit box
      this._newWorkout(e);
      console.log(this.#editedWorkout);
      
      // establish item to cancel (edited old element) based on date
      const currentObjDate = this.#editedWorkout.date;
      const objToDel = this.#workouts.find(el => {
        if (el.date === currentObjDate) return el;
      });
      const liToDel = document.querySelector(`[data-id="${objToDel.id}"]`);
      this._deleteItem(liToDel);
      
      // close edit window
      editBox.classList.add('edit-box--hidden');
    });
  }

  _clickCheck(e) {
    const clickedElem = e.target;
    const workout = e.target.closest('li');
    if (clickedElem.classList.contains('delete-item')) {
      this._deleteItem(workout);
      return;
    }
    if (clickedElem.classList.contains('edit-item')) {
      this._editItem.call(this, clickedElem);
      return;
    }
    this._moveToPopup(e);
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
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pl/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
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
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputType.value = 'running';
    inputElevation.closest('.form__row').classList.add('form__row--hidden');
    inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    inputDistance.focus();
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

  _newWorkout(e) {
    const isDataEdited = e.target.classList.contains('form__btn--ok');
    console.log(this.#editedWorkout);

    // helper functions
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    let type, distance, duration, lat, lng;

    // get data
    if (isDataEdited) {
      // get data from edit window
      type = editInputType.value;
      distance = +editInputDistance.value;
      duration = +editInputDuration.value;
      lat = this.#editedWorkout.coords[0];
      lng = this.#editedWorkout.coords[1];
      // const { lat, lng } = this.#editedWorkout.coords;
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
      if (isDataEdited) cadence = +editInputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert('Inputs have to be positive numbers!');
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      let elevation = +inputElevation.value;
      if (isDataEdited) elevation = +editInputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert('Inputs have to be positive numbers!');
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
  }

  _renderWorkoutMarker(workout) {
    this.#markers[this.#i] = new L.Marker(
      [workout.coords[0], workout.coords[1]],
      {
        draggable: true,
      }
    );
    this.#map.addLayer(this.#markers[this.#i]);
    this.#markers[this.#i]
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
      .openPopup().leafletid = this.#i;

    this.#i++;

    // L.marker(workout.coords)
    //   .addTo(this.#map)
    //   .bindPopup(
    //     L.popup({
    //       maxWidth: 250,
    //       minWidth: 100,
    //       autoClose: false,
    //       closeOnClick: false,
    //       className: `${workout.type}-popup`,
    //     })
    //   )
    //   .setPopupContent(
    //     `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
    //   )
    //   .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${
      workout.id
    }" data-leafletId="${this.#i}">
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

    form.insertAdjacentHTML('afterend', html);
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
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _deleteItem(elem) {
    // del elem from html
    containerWorkouts.removeChild(elem);

    // reduce array with workouts
    this.#workouts.splice(elem, 1);

    // clear local storage when no workouts
    if (this.#workouts.length === 0) this.reset();

    // fetch data from local storage
    const data = JSON.parse(localStorage.getItem('workouts'));

    // remove outdated array
    localStorage.removeItem('workouts');

    // find object to delete from fetched local storage data
    let elemToDel = data.find(el => el.id === elem.dataset.id);

    // deleting
    data.splice(elemToDel, 1);

    // setting current data into local storage
    localStorage.setItem('workouts', JSON.stringify(data));

    // remove single popup marker = remove layer from map
    const indexMarkerToDel = elem.dataset.leafletid;
    this.#map.removeLayer(this.#markers[indexMarkerToDel]);
  }

  _editItem(clickedElem) {
    let item = clickedElem.closest('li');
    let workoutObj = this.#workouts.find(el => el.id === item.dataset.id);
    this.#editedWorkout = workoutObj;
    console.log(this.#editedWorkout);
    // edit box title of item
    let itemTitle = item.children[0].textContent;
    boxTitle.textContent = itemTitle;

    // type
    let type = item.classList[1].slice(9);
    type === 'running'
      ? (editInputType.value = 'running')
      : (editInputType.value = 'cycling');

    // distance
    const distance = item.children[1].children[1].textContent;
    editInputDistance.value = distance;

    // duration
    const duration = item.children[2].children[1].textContent;
    editInputDuration.value = duration;

    // cadence
    const cadence = item.children[3].children[1].textContent;
    editInputCadence.value = cadence;

    // elevation
    const elevation = item.children[4].children[1].textContent;
    editInputElevation.value = elevation;

    // setting wheter elev / cadence should be displayed
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
  }
}
const app = new App();
