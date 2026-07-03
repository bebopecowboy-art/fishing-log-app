const saveButton = document.getElementById("saveButton");

const fishingPlace = document.getElementById("fishingPlace");
const fishName = document.getElementById("fishName");
const fishSize = document.getElementById("fishSize");
const fishingMethod = document.getElementById("fishingMethod");
const memo = document.getElementById("memo");
const locationButton =
    document.getElementById("locationButton");

const resultArea = document.getElementById("resultArea");

let currentTemperature = "";
let currentWindSpeed = "";
let currentWeather = "";

let fishingLogs = JSON.parse(localStorage.getItem("fishingLogs")) || [];

showLogs();

saveButton.addEventListener("click", function () {
    const place = fishingPlace.value;
    const name = fishName.value;
    const size = fishSize.value;
    const method = fishingMethod.value;
    const memoText = memo.value;
    if (name === "") {
        alert("魚種を入力してね");
    return;
    }

    const now = new Date();

    const dateText = now.toLocaleDateString("ja-JP");
    const timeText = now.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
    });

    const log = {
        date: dateText,
        time: timeText,
        place: place,
        temperature: currentTemperature,
        windSpeed: currentWindSpeed,
        weather: currentWeather,
        name: name,
        size: size,
        method: method,
        memo: memoText
        
    };

    fishingLogs.unshift(log);

    localStorage.setItem("fishingLogs", JSON.stringify(fishingLogs));

    showLogs();

    fishingPlace.value = "";
    fishName.value = "";
    fishSize.value = "";
    fishingMethod.value = "";
    memo.value = "";
});

function showLogs() {
    resultArea.innerHTML = "";

    fishingLogs.forEach(function (log, index) {
        const card = document.createElement("div");

        card.classList.add("result-card");

        card.innerHTML = `
            <p>日付: ${log.date || "未記録"}</p>
            <p>時間: ${log.time || "未記録"}</p>
            <p>場所: ${log.place || "未記録"}</p>
            <p>天気: ${log.weather || "未記録"}</p>
            <p>気温: ${log.temperature || "未記録"}℃</p>
            <p>風速: ${log.windSpeed || "未記録"}m/s</p>
            <p>魚種: ${log.name}</p>
            <p>サイズ: ${log.size} cm</p>
            <p>釣り方: ${log.method}</p>
            <p>メモ: ${log.memo || ""}</p>
            <button onclick="deleteLog(${index})">削除</button>
        `;

        resultArea.appendChild(card);
    });
}

function deleteLog(index) {
    fishingLogs.splice(index, 1);

    localStorage.setItem("fishingLogs", JSON.stringify(fishingLogs));

    showLogs();
}

locationButton.addEventListener(
    "click",
    function () {

        navigator.geolocation.getCurrentPosition(
            function (position) {

                const latitude =
                position.coords.latitude.toFixed(4);

                const longitude =
                position.coords.longitude.toFixed(4);
                
                const locationText = document.getElementById("locationText");

                locationText.textContent =
                    "緯度: " + latitude + " / 経度: " + longitude;

                getPlaceName(latitude, longitude);

                getWeather(latitude, longitude);    

            }
        );

    }
);

async function getWeather(latitude, longitude) {

    const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`;

    const response = await fetch(url);

    const data = await response.json();

    const temperature =
    data.current.temperature_2m;

    /*
    const windSpeed =
        data.current.wind_speed_10m;

    currentWindSpeed = windSpeed;
    */

    const weatherCode =
    data.current.weather_code;

    let weatherText = "不明";

    if (weatherCode === 0) {
        weatherText = "晴れ";
    }
    else if (weatherCode === 1) {
        weatherText = "ほぼ晴れ";
    }
    else if (weatherCode === 2) {
        weatherText = "曇り";
    }
    else if (weatherCode === 3) {
        weatherText = "曇り";
    }
    else if (weatherCode >= 51) {
        weatherText = "雨";
    }

    currentTemperature = temperature;
    currentWeather = weatherText;

    document.getElementById("weatherText").textContent =
    "天気: " + weatherText +
    " / 気温: " + temperature + "℃";

    /*
    document.getElementById("windText").textContent =
    "風速: " + windSpeed + "m/s";
    */
}

async function getPlaceName(latitude, longitude) {
    const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=ja`;

    const response = await fetch(url);
    const data = await response.json();

    console.log(data);

    const address = data.address;

    const placeName =
    address.hamlet ||
    address.neighbourhood ||
    address.suburb ||
    address.town ||
    address.village ||
    address.city ||
    address.county ||
    data.display_name ||
    "場所名不明";

    fishingPlace.value = placeName;
}