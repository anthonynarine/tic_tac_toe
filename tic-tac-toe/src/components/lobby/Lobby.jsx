import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameContext } from "../context/gameContext";
import useGameServices from "../hooks/useGameServices";
import "./lobby.css"

const Lobby = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state, dispatch } = useGameServices();
    const { fetchGame, startGame } = useGameServices();
}