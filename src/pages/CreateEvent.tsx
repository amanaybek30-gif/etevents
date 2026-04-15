import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const CreateEvent = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate("/auth?intent=organizer"); }, [navigate]);
  return null;
};

export default CreateEvent;
